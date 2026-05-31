import { ModuleManifest } from "../../../shared/module.types.js";

export function assertVoiceCommandCapability(manifest: ModuleManifest): void {
  if (!manifest.capabilities.includes("request_command")) {
    throw new Error("VOICE_CAPABILITY_REQUEST_COMMAND_MISSING");
  }
}
