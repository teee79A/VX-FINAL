import { ModuleManifest } from "../../../shared/module.types.js";

export function assertCanRequestCommand(manifest: ModuleManifest): void {
  if (!manifest.capabilities.includes("request_command")) {
    throw new Error("CALENDAR_CAPABILITY_REQUEST_COMMAND_MISSING");
  }
}
