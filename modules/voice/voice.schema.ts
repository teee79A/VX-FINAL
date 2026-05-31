export const VoiceSchema = {
  operations: ["synthesize", "route_profile"] as const,
  lanes: ["piper", "xtts", "openvoice"] as const
};
