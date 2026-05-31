export type CalendarInput =
  | { op: "list_events"; fromUtc: string; toUtc: string }
  | { op: "propose_schedule"; atUtc: string; title: string };

export type CalendarOutput =
  | { events: Array<{ id: string; title: string; atUtc: string }> }
  | { proposed: true; title: string; atUtc: string };
