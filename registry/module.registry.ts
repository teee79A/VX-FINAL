import { TerminalModule } from "../shared/module.contract.js";

export class ModuleRegistry {
  private readonly modules = new Map<string, TerminalModule>();

  register(name: string, mod: TerminalModule): void {
    if (this.modules.has(name)) {
      throw new Error(`MODULE_ALREADY_REGISTERED:${name}`);
    }
    this.modules.set(name, mod);
  }

  get(name: string): TerminalModule {
    const mod = this.modules.get(name);
    if (!mod) {
      throw new Error(`MODULE_NOT_FOUND:${name}`);
    }
    return mod;
  }

  list(): string[] {
    return [...this.modules.keys()];
  }
}
