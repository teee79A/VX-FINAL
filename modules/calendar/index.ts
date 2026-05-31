import { CalendarModule } from "./calendar.module.js";

export async function createCalendarModule(): Promise<CalendarModule> {
  const module = new CalendarModule();
  await module.init();
  return module;
}
