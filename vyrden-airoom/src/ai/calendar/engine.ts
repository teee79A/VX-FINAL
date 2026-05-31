// VYRDON AI Room — Calendar Engine
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type {
  CalendarEvent,
  CalendarQuery,
  CalendarStats,
  EventPriority,
  EventStatus,
  Reminder,
  ScheduleRequest,
  ScheduleResult,
  TimeSlot,
} from './types.js';

export class CalendarEngine {
  private readonly events: Map<string, CalendarEvent>;
  private readonly defaultTimezone: string;

  constructor(defaultTimezone = 'UTC') {
    this.events = new Map();
    this.defaultTimezone = defaultTimezone;
  }

  createEvent(
    title: string,
    startTime: string,
    endTime: string,
    options: Partial<Omit<CalendarEvent, 'id' | 'title' | 'startTime' | 'endTime' | 'createdAt' | 'updatedAt' | 'evidenceRef'>> = {},
  ): CalendarEvent {
    const id = randomUUID();
    const now = new Date().toISOString();

    const event: CalendarEvent = {
      id,
      title,
      startTime,
      endTime,
      timezone: options.timezone ?? this.defaultTimezone,
      priority: options.priority ?? 'normal',
      status: options.status ?? 'scheduled',
      attendees: options.attendees ?? [],
      tags: options.tags ?? [],
      reminders: options.reminders ?? [],
      metadata: options.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      evidenceRef: `vyrden.calendar.event.${id}`,
      ...(options.description !== undefined && { description: options.description }),
      ...(options.location !== undefined && { location: options.location }),
      ...(options.recurrence !== undefined && { recurrence: options.recurrence }),
    };

    this.events.set(id, event);
    return event;
  }

  getEvent(id: string): CalendarEvent | null {
    return this.events.get(id) ?? null;
  }

  updateEvent(id: string, updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt' | 'evidenceRef'>>): CalendarEvent | null {
    const event = this.events.get(id);
    if (!event) return null;

    const updated: CalendarEvent = {
      ...event,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.events.set(id, updated);
    return updated;
  }

  deleteEvent(id: string): boolean {
    return this.events.delete(id);
  }

  cancelEvent(id: string): CalendarEvent | null {
    return this.updateEvent(id, { status: 'cancelled' });
  }

  postponeEvent(id: string, newStartTime: string, newEndTime: string): CalendarEvent | null {
    return this.updateEvent(id, {
      startTime: newStartTime,
      endTime: newEndTime,
      status: 'postponed',
    });
  }

  query(query: CalendarQuery): readonly CalendarEvent[] {
    let results = Array.from(this.events.values());

    if (query.startDate) {
      const start = new Date(query.startDate).getTime();
      results = results.filter((e) => new Date(e.startTime).getTime() >= start);
    }

    if (query.endDate) {
      const end = new Date(query.endDate).getTime();
      results = results.filter((e) => new Date(e.endTime).getTime() <= end);
    }

    if (query.status) {
      results = results.filter((e) => e.status === query.status);
    }

    if (query.priority) {
      results = results.filter((e) => e.priority === query.priority);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((e) => query.tags!.some((tag) => e.tags.includes(tag)));
    }

    if (query.attendees && query.attendees.length > 0) {
      results = results.filter((e) => query.attendees!.some((a) => e.attendees.includes(a)));
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      results = results.filter(
        (e) =>
          e.title.toLowerCase().includes(searchLower) ||
          e.description?.toLowerCase().includes(searchLower),
      );
    }

    return results.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  getUpcoming(limit = 10): readonly CalendarEvent[] {
    const now = new Date().toISOString();
    return this.query({ startDate: now, status: 'scheduled' }).slice(0, limit);
  }

  getOverdue(): readonly CalendarEvent[] {
    const now = new Date().toISOString();
    return Array.from(this.events.values())
      .filter((e) => e.status === 'scheduled' && e.endTime < now)
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
  }

  findConflicts(startTime: string, endTime: string, excludeEventId?: string): readonly CalendarEvent[] {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return Array.from(this.events.values()).filter((e) => {
      if (excludeEventId && e.id === excludeEventId) return false;
      if (e.status === 'cancelled') return false;

      const eventStart = new Date(e.startTime).getTime();
      const eventEnd = new Date(e.endTime).getTime();

      return start < eventEnd && end > eventStart;
    });
  }

  findAvailableSlots(
    startDate: string,
    endDate: string,
    durationMinutes: number,
    workdayStart = 9,
    workdayEnd = 17,
  ): readonly TimeSlot[] {
    const slots: TimeSlot[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    const current = new Date(start);
    current.setHours(workdayStart, 0, 0, 0);

    while (current < end) {
      const dayOfWeek = current.getDay();
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        current.setDate(current.getDate() + 1);
        current.setHours(workdayStart, 0, 0, 0);
        continue;
      }

      const slotEnd = new Date(current.getTime() + durationMinutes * 60000);
      const dayEnd = new Date(current);
      dayEnd.setHours(workdayEnd, 0, 0, 0);

      if (slotEnd <= dayEnd) {
        const conflicts = this.findConflicts(current.toISOString(), slotEnd.toISOString());

        slots.push({
          start: current.toISOString(),
          end: slotEnd.toISOString(),
          available: conflicts.length === 0,
          conflictingEventIds: conflicts.map((c) => c.id),
        });

        current.setTime(slotEnd.getTime());
      } else {
        current.setDate(current.getDate() + 1);
        current.setHours(workdayStart, 0, 0, 0);
      }
    }

    return slots;
  }

  scheduleAuto(request: ScheduleRequest): ScheduleResult {
    const timezone = request.timezone ?? this.defaultTimezone;
    const now = new Date();
    const searchEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks

    const availableSlots = this.findAvailableSlots(
      now.toISOString(),
      searchEnd.toISOString(),
      request.duration,
    ).filter((s) => s.available);

    if (availableSlots.length === 0) {
      return {
        success: false,
        suggestedSlots: [],
        conflicts: this.getUpcoming(5) as CalendarEvent[],
        evidenceRef: `vyrden.calendar.schedule.fail.${Date.now()}`,
      };
    }

    // Pick first available slot
    const slot = availableSlots[0]!;
    const eventOptions: Partial<Omit<CalendarEvent, 'id' | 'title' | 'startTime' | 'endTime' | 'createdAt' | 'updatedAt' | 'evidenceRef'>> = {
      priority: request.priority,
      timezone,
      attendees: [...(request.requiredAttendees ?? []), ...(request.optionalAttendees ?? [])],
    };
    if (request.description !== undefined) {
      eventOptions.description = request.description;
    }
    const event = this.createEvent(request.title, slot.start, slot.end, eventOptions);

    return {
      success: true,
      event,
      suggestedSlots: availableSlots.slice(0, 5),
      evidenceRef: event.evidenceRef,
    };
  }

  addReminder(eventId: string, minutesBefore: number, type: Reminder['type'] = 'notification'): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    const reminder: Reminder = {
      id: randomUUID(),
      type,
      minutesBefore,
      sent: false,
    };

    this.updateEvent(eventId, {
      reminders: [...event.reminders, reminder],
    });

    return true;
  }

  markReminderSent(eventId: string, reminderId: string): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    const updatedReminders = event.reminders.map((r) =>
      r.id === reminderId ? { ...r, sent: true, sentAt: new Date().toISOString() } : r,
    );

    this.updateEvent(eventId, { reminders: updatedReminders });
    return true;
  }

  getDueReminders(): readonly { event: CalendarEvent; reminder: Reminder }[] {
    const now = Date.now();
    const results: { event: CalendarEvent; reminder: Reminder }[] = [];

    for (const event of this.events.values()) {
      if (event.status === 'cancelled') continue;

      const eventStart = new Date(event.startTime).getTime();

      for (const reminder of event.reminders) {
        if (reminder.sent) continue;

        const reminderTime = eventStart - reminder.minutesBefore * 60000;
        if (reminderTime <= now && reminderTime > now - 60000) {
          results.push({ event, reminder });
        }
      }
    }

    return results;
  }

  getStats(): CalendarStats {
    const now = new Date().toISOString();
    const byStatus: Record<EventStatus, number> = {
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      postponed: 0,
    };
    const byPriority: Record<EventPriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      critical: 0,
    };

    let upcomingCount = 0;
    let overdueCount = 0;

    for (const event of this.events.values()) {
      byStatus[event.status]++;
      byPriority[event.priority]++;

      if (event.status === 'scheduled') {
        if (event.startTime > now) {
          upcomingCount++;
        } else if (event.endTime < now) {
          overdueCount++;
        }
      }
    }

    return {
      totalEvents: this.events.size,
      byStatus,
      byPriority,
      upcomingCount,
      overdueCount,
    };
  }

  clear(): void {
    this.events.clear();
  }

  size(): number {
    return this.events.size;
  }
}

// Singleton instance
export const calendarEngine = new CalendarEngine();
