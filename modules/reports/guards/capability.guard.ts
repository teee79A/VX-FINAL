import { ModuleManifest } from "../../../shared/module.types.js";

export function assertReportsCommandCapability(manifest: ModuleManifest): void {
  if (!manifest.capabilities.includes("request_command")) {
    throw new Error("REPORTS_CAPABILITY_REQUEST_COMMAND_MISSING");
  }
}
