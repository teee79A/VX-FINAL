import { SafeCommand } from "./command.types.js";
import { CommandPolicy } from "../policy/command.policy.js";

export class PolicyLayer {
  private readonly commandPolicy = new CommandPolicy();

  assert(command: SafeCommand): void {
    this.commandPolicy.assert(command);
  }
}
