import { ResultEnvelope } from "../shared/result.types.js";
import { BrainProvider, SafeCommand } from "./command.types.js";
import { CommandBus } from "./command.bus.js";

export class CommandGateway {
  constructor(private readonly bus = new CommandBus()) {}

  async accept(
    command: SafeCommand
  ): Promise<
    ResultEnvelope<{
      accepted: boolean;
      route?: string;
      provider?: BrainProvider;
      outputPreview?: string;
      externalRequestId?: string;
      evidenceRef?: string;
    }>
  > {
    return this.bus.submit(command);
  }
}
