export type MemoryInput =
  | { op: "recall"; sessionId: string }
  | { op: "append"; sessionId: string; item: string };

export type MemoryOutput =
  | { sessionId: string; items: string[] }
  | { appended: true; sessionId: string; item: string };
