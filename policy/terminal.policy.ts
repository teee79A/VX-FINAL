import { RequestedCommand } from "../shared/module.contract.js";
import { ModuleManifest, ModuleCapability } from "../shared/module.types.js";
import { ModuleRequest } from "../shared/terminal.types.js";
import { TerminalErrorCode } from "../shared/error.types.js";
import { DenyReasons } from "./deny-reasons.js";

export class TerminalPolicy {
  async assertModuleAccess(
    manifest: ModuleManifest,
    request: ModuleRequest<unknown>
  ): Promise<void> {
    if (request.module !== manifest.name) {
      throw new TerminalErrorCode(
        DenyReasons.MODULE_NAME_MISMATCH,
        "Request module does not match manifest module."
      );
    }

    if (!request.context.actorRole) {
      throw new TerminalErrorCode(
        DenyReasons.ACTOR_ROLE_MISSING,
        "Actor role is required."
      );
    }

    if (request.action.startsWith("exec:")) {
      throw new TerminalErrorCode(
        DenyReasons.DIRECT_EXECUTION_FORBIDDEN,
        "Modules cannot execute runtime actions directly."
      );
    }
  }

  async assertCommandRequest(
    manifest: ModuleManifest,
    _request: ModuleRequest<unknown>,
    _command: RequestedCommand
  ): Promise<void> {
    if (!manifest.capabilities.includes("request_command")) {
      throw new TerminalErrorCode(
        DenyReasons.MODULE_CANNOT_REQUEST_COMMAND,
        "Module lacks request_command capability."
      );
    }
  }

  assertCapability(
    manifest: ModuleManifest,
    capability: ModuleCapability
  ): void {
    if (!manifest.capabilities.includes(capability)) {
      throw new TerminalErrorCode(
        DenyReasons.CAPABILITY_REQUIRED,
        `Required capability missing: ${capability}`
      );
    }
  }
}
