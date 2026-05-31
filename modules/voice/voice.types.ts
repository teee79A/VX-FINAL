export type VoiceInput =
  | { op: "synthesize"; text: string; voiceProfile: string }
  | { op: "route_profile"; voiceProfile: string; lane: "piper" | "xtts" | "openvoice" };

export type VoiceOutput =
  | { streamId: string; voiceProfile: string; synthesized: true }
  | { voiceProfile: string; lane: "piper" | "xtts" | "openvoice"; routed: true };
