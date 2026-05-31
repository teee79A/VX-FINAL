import { TerminalModule } from "../shared/module.contract.js";
import { ModuleRequest } from "../shared/terminal.types.js";
import { ResultEnvelope } from "../shared/result.types.js";
import { TerminalPolicy } from "../policy/terminal.policy.js";

export class ModuleWrapper {
  constructor(
    private readonly policy: TerminalPolicy,
    private readonly mod: TerminalModule
  ) {}

  async process<TIn, TOut>(
    request: ModuleRequest<TIn>
  ): Promise<ResultEnvelope<TOut>> {
    await this.policy.assertModuleAccess(this.mod.manifest, request);
    return this.mod.process(request) as Promise<ResultEnvelope<TOut>>;
  }
}
