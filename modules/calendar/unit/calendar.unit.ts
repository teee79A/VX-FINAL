import { CalendarProcessor } from "../processor/calendar.processor.js";
import { CalendarInput, CalendarOutput } from "../calendar.types.js";

export class CalendarUnit {
  private readonly processor = new CalendarProcessor();

  async run(input: CalendarInput): Promise<CalendarOutput> {
    return this.processor.process(input);
  }
}
