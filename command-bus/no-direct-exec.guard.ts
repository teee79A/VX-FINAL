import { TerminalErrorCode } from "../shared/error.types.js";
import { DenyReasons } from "../policy/deny-reasons.js";

export class NoDirectExecGuard {
  assert(command: { type: string; source: string }): void {
    if (command.type.startsWith("runtime.exec")) {
      throw new TerminalErrorCode(
        DenyReasons.RUNTIME_EXEC_NOT_ALLOWED_FROM_TERMINAL_MODULE,
        "Runtime execution command types are blocked in terminal modules."
      );
    }

    if (
      command.source.startsWith("module:") &&
      command.type.startsWith("vyrdx.exec")
    ) {
      throw new TerminalErrorCode(
        DenyReasons.MODULE_BYPASS_ATTEMPT_DETECTED,
        "Module attempted execution bypass."
      );
    }
  }
}
