export type AudioInput =
  | { op: "capture_level"; roomId: string; levelDb: number }
  | { op: "transcribe_chunk"; roomId: string; chunkId: string; transcriptHint?: string };

export type AudioOutput =
  | { roomId: string; levelDb: number; status: "ok" | "hot" | "silent" }
  | { roomId: string; chunkId: string; transcript: string };
