import { SafeCommand } from "../command-bus/command.types.js";

export interface TerminalInput {
  type: string;
  target: string;
  payload?: Record<string, unknown>;
  reason: string;
}

export class InputParser {
  parse(input: TerminalInput): Omit<SafeCommand, "source"> {
    return {
      type: input.type,
      target: input.target,
      payload: input.payload ?? {},
      reason: input.reason
    };
  }
}
