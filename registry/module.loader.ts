import { TerminalModule } from "../shared/module.contract.js";
import { ManifestValidator } from "./manifest.validator.js";

export class ModuleLoader {
  private readonly manifestValidator = new ManifestValidator();

  public async load(
    factory: () => Promise<TerminalModule>
  ): Promise<TerminalModule> {
    const mod = await factory();
    this.manifestValidator.validate(mod.manifest);
    if (
      mod.manifest.capabilities.includes("request_command") &&
      typeof mod.requestCommand !== "function"
    ) {
      throw new Error("MODULE_REQUEST_COMMAND_PROCESSOR_MISSING");
    }

    if ("execute" in (mod as object) || "seal" in (mod as object)) {
      throw new Error("MODULE_SOVEREIGN_METHOD_FORBIDDEN");
    }

    await mod.init();
    return mod;
  }
}
