import { ModuleCapability, ModuleManifest } from "../shared/module.types.js";
import { TerminalErrorCode } from "../shared/error.types.js";
import { DenyReasons } from "./deny-reasons.js";

export class CapabilityPolicy {
  assert(manifest: ModuleManifest, capability: ModuleCapability): void {
    if (!manifest.capabilities.includes(capability)) {
      throw new TerminalErrorCode(
        DenyReasons.CAPABILITY_REQUIRED,
        `Capability not allowed: ${capability}`
      );
    }
  }
}
