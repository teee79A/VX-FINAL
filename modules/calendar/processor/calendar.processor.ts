import { CalendarInput, CalendarOutput } from "../calendar.types.js";

export class CalendarProcessor {
  async process(input: CalendarInput): Promise<CalendarOutput> {
    if (input.op === "list_events") {
      return {
        events: []
      };
    }
    return {
      proposed: true,
      title: input.title,
      atUtc: input.atUtc
    };
  }
}
