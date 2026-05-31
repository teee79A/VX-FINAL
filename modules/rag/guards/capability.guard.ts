import { ModuleManifest } from "../../../shared/module.types.js";

export function assertRagCommandCapability(manifest: ModuleManifest): void {
  if (!manifest.capabilities.includes("request_command")) {
    throw new Error("RAG_CAPABILITY_REQUEST_COMMAND_MISSING");
  }
}
