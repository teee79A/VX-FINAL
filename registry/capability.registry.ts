import { ModuleCapability } from "../shared/module.types.js";

export class CapabilityRegistry {
  private readonly registry = new Map<string, Set<ModuleCapability>>();

  register(moduleName: string, capabilities: ModuleCapability[]): void {
    this.registry.set(moduleName, new Set(capabilities));
  }

  has(moduleName: string, capability: ModuleCapability): boolean {
    const caps = this.registry.get(moduleName);
    return caps ? caps.has(capability) : false;
  }

  list(moduleName: string): ModuleCapability[] {
    return [...(this.registry.get(moduleName) ?? new Set<ModuleCapability>())];
  }
}
