// VYRDON AI Room — Calendar Engine Types
// vyrden.com — Hidden Operations Center

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export type EventPriority = 'low' | 'normal' | 'high' | 'critical';
export type EventStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  timezone: string;
  location?: string;
  priority: EventPriority;
  status: EventStatus;
  attendees: readonly string[];
  tags: readonly string[];
  recurrence?: RecurrenceRule;
  reminders: readonly Reminder[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  evidenceRef: string;
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: string;
  count?: number;
  daysOfWeek?: readonly number[]; // 0=Sunday, 6=Saturday
  dayOfMonth?: number;
  monthOfYear?: number;
}

export interface Reminder {
  id: string;
  type: 'notification' | 'email' | 'webhook';
  minutesBefore: number;
  sent: boolean;
  sentAt?: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
  conflictingEventIds?: readonly string[];
}

export interface ScheduleRequest {
  title: string;
  description?: string;
  duration: number; // minutes
  priority: EventPriority;
  preferredTimes?: readonly { start: string; end: string }[];
  requiredAttendees?: readonly string[];
  optionalAttendees?: readonly string[];
  timezone?: string;
}

export interface ScheduleResult {
  success: boolean;
  event?: CalendarEvent;
  suggestedSlots?: readonly TimeSlot[];
  conflicts?: readonly CalendarEvent[];
  evidenceRef: string;
}

export interface CalendarQuery {
  startDate?: string;
  endDate?: string;
  status?: EventStatus;
  priority?: EventPriority;
  tags?: readonly string[];
  attendees?: readonly string[];
  search?: string;
}

export interface CalendarStats {
  totalEvents: number;
  byStatus: Record<EventStatus, number>;
  byPriority: Record<EventPriority, number>;
  upcomingCount: number;
  overdueCount: number;
}
