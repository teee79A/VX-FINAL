// VYRDON AI Room Engine Adapter
// Bridge to KITTY engines — vyrden.com

import { randomUUID } from 'node:crypto';
import { type EngineResult } from '../core/types.js';
import { getConfig } from '../core/config.js';

interface EngineRequest {
  engineId: string;
  input: Record<string, unknown>;
  requestId?: string;
}

interface KittyEngineModule {
  execute(engineId: string, input: unknown): Promise<Record<string, unknown>>;
}

let _kittyEngines: KittyEngineModule | null = null;

async function loadKittyEngines(): Promise<KittyEngineModule> {
  if (_kittyEngines) return _kittyEngines;

  const config = getConfig();
  const enginePath = `${config.kittyRoot}/ENGINES/index.js`;

  try {
    const mod = await import(enginePath);
    _kittyEngines = {
      execute: async (engineId: string, input: unknown) => {
        const engineMap = mod.engineMap as Map<string, { execute: (input: unknown) => Promise<unknown> }>;
        const engine = engineMap.get(engineId);
        if (!engine) throw new Error(`ENGINE_NOT_FOUND: ${engineId}`);
        const result = await engine.execute(input);
        return result as Record<string, unknown>;
      },
    };
    return _kittyEngines;
  } catch (e: unknown) {
    throw new Error(`KITTY_ENGINES_LOAD_FAILED: ${String(e)}`);
  }
}

export async function executeEngine(request: EngineRequest): Promise<EngineResult> {
  const requestId = request.requestId ?? randomUUID();
  const timestamp = new Date().toISOString();

  try {
    const engines = await loadKittyEngines();
    const result = await engines.execute(request.engineId, request.input);

    return {
      engineId: request.engineId,
      type: 'success',
      result,
      timestamp,
      evidenceRef: `kitty.engine.${request.engineId}.${requestId}`,
    };
  } catch (e: unknown) {
    return {
      engineId: request.engineId,
      type: 'error',
      result: { error: String(e) },
      timestamp,
      evidenceRef: `kitty.engine.${request.engineId}.${requestId}.error`,
    };
  }
}

export async function getEngineCount(): Promise<number> {
  try {
    const _engines = await loadKittyEngines();
    const mod = await import(`${getConfig().kittyRoot}/ENGINES/index.js`);
    const engineMap = mod.engineMap as Map<string, unknown>;
    return engineMap.size;
  } catch {
    return 0;
  }
}

export async function listEngines(): Promise<readonly string[]> {
  try {
    const mod = await import(`${getConfig().kittyRoot}/ENGINES/index.js`);
    const engineMap = mod.engineMap as Map<string, unknown>;
    return Array.from(engineMap.keys());
  } catch {
    return [];
  }
}
