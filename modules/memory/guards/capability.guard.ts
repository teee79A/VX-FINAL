import { ModuleManifest } from "../../../shared/module.types.js";

export function assertMemoryCommandCapability(manifest: ModuleManifest): void {
  if (!manifest.capabilities.includes("request_command")) {
    throw new Error("MEMORY_CAPABILITY_REQUEST_COMMAND_MISSING");
  }
}
