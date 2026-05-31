export const NodeCapabilities = {
  GPU_INFERENCE: "gpu.inference",
  BRAIN_VLLM: "brain.vllm",
  BRAIN_OPENROUTER: "brain.openrouter",
  TIME_STATE: "time.state",
  CALENDAR_STATE: "calendar.state",
  LINUX_ADMIN_POWER: "linux.admin.power",
  LINUX_ADMIN_STATUS: "linux.admin.status",
  LINUX_ADMIN_LOGS: "linux.admin.logs",
  VOICE_TTS: "voice.tts",
  VOICE_CLONE: "voice.clone",
  OPENHANDS_RUNTIME: "openhands.runtime",
  THUNDER_WORKSPACE: "thunder.workspace",
  CODEX_WORKSPACE: "codex.workspace"
} as const;

export function hasRequiredCapabilities(
  available: readonly string[],
  required: readonly string[]
): boolean {
  if (!required.length) {
    return false;
  }
  return required.every((capability) => available.includes(capability));
}
