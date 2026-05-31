import { SafeCommand } from "../command-bus/command.types.js";

export class CommandBuilder {
  build(parsed: Omit<SafeCommand, "source">): SafeCommand {
    return {
      ...parsed,
      source: "operator"
    };
  }
}
