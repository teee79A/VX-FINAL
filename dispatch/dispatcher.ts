import { CommandReceipt, SafeCommand } from "../command-bus/command.types.js";
import { CommandDispatcher } from "../command-bus/command.dispatcher.js";

export class Dispatcher {
  constructor(private readonly commandDispatcher = new CommandDispatcher()) {}

  async dispatch(command: SafeCommand): Promise<CommandReceipt> {
    return this.commandDispatcher.dispatch(command);
  }
}
