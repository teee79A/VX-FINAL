import { CommandBus } from "../command-bus/command.bus.js";
import { ModuleHost } from "../shared/module.host.js";
import { ResultEnvelope } from "../shared/result.types.js";
import { EventWrapper } from "./event.wrapper.js";

export class TerminalHost implements ModuleHost {
  constructor(
    private readonly bus: CommandBus,
    private readonly events = new EventWrapper()
  ) {}

  async emit(event: { type: string; payload: unknown }): Promise<void> {
    this.events.emit(event);
  }

  async requestCommand(command: {
    type: string;
    target: string;
    payload: Record<string, unknown>;
    reason: string;
    required_capabilities?: string[];
    preferred_node_id?: string;
  }): Promise<ResultEnvelope<{ accepted: boolean; route?: string }>> {
    return this.bus.submit({
      ...command,
      source: "terminal-shell"
    });
  }

  async readScopedState<T>(_key: string): Promise<T | null> {
    return null;
  }
}
