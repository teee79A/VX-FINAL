import { ModuleManifest } from "../../../shared/module.types.js";

export function assertAudioCommandCapability(manifest: ModuleManifest): void {
  if (!manifest.capabilities.includes("request_command")) {
    throw new Error("AUDIO_CAPABILITY_REQUEST_COMMAND_MISSING");
  }
}
