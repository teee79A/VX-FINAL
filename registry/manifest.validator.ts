import { ModuleManifest } from "../shared/module.types.js";
import { TerminalErrorCode } from "../shared/error.types.js";

export class ManifestValidator {
  validate(manifest: ModuleManifest): void {
    if (!manifest.name || !manifest.version) {
      throw new TerminalErrorCode(
        "MODULE_MANIFEST_INVALID",
        "Module manifest requires name and version."
      );
    }
    if (
      manifest.capabilities.includes("request_command") &&
      manifest.permissions.length === 0
    ) {
      throw new TerminalErrorCode(
        "MODULE_COMMAND_PERMISSION_MISSING",
        "request_command capability requires explicit permissions."
      );
    }
  }
}
