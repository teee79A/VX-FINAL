import { SafeCommand } from "./command.types.js";
import { TerminalErrorCode } from "../shared/error.types.js";

export class ValidationLayer {
  assert(command: SafeCommand): void {
    if (!command.type || !command.target || !command.source) {
      throw new TerminalErrorCode(
        "COMMAND_INVALID",
        "SafeCommand requires type, source, and target."
      );
    }
    if (!command.reason) {
      throw new TerminalErrorCode(
        "COMMAND_REASON_REQUIRED",
        "SafeCommand requires reason."
      );
    }
  }
}
