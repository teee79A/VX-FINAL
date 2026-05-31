/**
 * VYRDX Module Bridge
 * TypeScript bridge for spawning and monitoring /opt/vyrdx JavaScript modules
 */

import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import type { VyrdxModuleName, VyrdxModuleStatus } from "./vyrdx.types.js";
import {
  readMarketModel,
  readSystemHealth,
  readRiskProfile,
  readLearningMemory,
  isVyrdxAccessible,
  getVyrdxRoot,
} from "./vyrdx.readers.js";

const MODULE_NAMES: VyrdxModuleName[] = [
  "analytics",
  "hardware",
  "health",
  "market",
  "opportunity",
  "security",
  "supervision",
];

interface ModuleHandle {
  name: VyrdxModuleName;
  process: ChildProcess | null;
  startedAt: string | null;
  exitCode: number | null;
}

const moduleHandles = new Map<VyrdxModuleName, ModuleHandle>();

function getModulePath(name: VyrdxModuleName): string {
  return `${getVyrdxRoot()}/core/modules/${name}.js`;
}

export function isModuleAvailable(name: VyrdxModuleName): boolean {
  return existsSync(getModulePath(name));
}

export function listAvailableModules(): VyrdxModuleName[] {
  return MODULE_NAMES.filter(isModuleAvailable);
}

export async function getModuleStatus(name: VyrdxModuleName): Promise<VyrdxModuleStatus> {
  const handle = moduleHandles.get(name);
  const available = isModuleAvailable(name);

  if (!available) {
    return {
      name,
      running: false,
      lastCheck: new Date().toISOString(),
      error: "Module file not found",
    };
  }

  const running = handle?.process !== null && handle?.exitCode === null;

  const status: VyrdxModuleStatus = {
    name,
    running,
    lastCheck: new Date().toISOString(),
  };

  if (handle && handle.exitCode !== null) {
    status.error = `Exited with code ${handle.exitCode}`;
  }

  return status;
}

export async function getAllModuleStatuses(): Promise<VyrdxModuleStatus[]> {
  return Promise.all(MODULE_NAMES.map(getModuleStatus));
}

export async function checkModuleHealth(name: VyrdxModuleName): Promise<boolean> {
  const now = Date.now();
  const staleThresholdMs = 30000;

  switch (name) {
    case "market": {
      const market = await readMarketModel();
      return market !== null && now - market.ts < staleThresholdMs;
    }
    case "health": {
      const health = await readSystemHealth();
      if (!health) return false;
      const updated = new Date(health.updatedAt).getTime();
      return now - updated < staleThresholdMs;
    }
    case "security":
    case "analytics": {
      const risk = await readRiskProfile();
      return risk !== null && now - risk.ts < staleThresholdMs;
    }
    case "supervision": {
      const learn = await readLearningMemory();
      if (!learn?.supervision) return false;
      const updated = new Date(learn.supervision.updatedAt).getTime();
      return now - updated < staleThresholdMs;
    }
    default:
      return isModuleAvailable(name);
  }
}

export interface VyrdxSystemStatus {
  accessible: boolean;
  root: string;
  modules: VyrdxModuleStatus[];
  healthyCount: number;
  totalCount: number;
  ts: number;
}

export async function getSystemStatus(): Promise<VyrdxSystemStatus> {
  const accessible = isVyrdxAccessible();
  const modules = await getAllModuleStatuses();

  const healthChecks = await Promise.all(MODULE_NAMES.map(checkModuleHealth));
  const healthyCount = healthChecks.filter(Boolean).length;

  return {
    accessible,
    root: getVyrdxRoot(),
    modules,
    healthyCount,
    totalCount: MODULE_NAMES.length,
    ts: Date.now(),
  };
}

export function spawnModule(name: VyrdxModuleName): ModuleHandle {
  if (!isModuleAvailable(name)) {
    throw new Error(`Module ${name} not available at ${getModulePath(name)}`);
  }

  const existing = moduleHandles.get(name);
  if (existing?.process && existing.exitCode === null) {
    return existing;
  }

  const modulePath = getModulePath(name);
  const proc = spawn("node", [modulePath], {
    stdio: "pipe",
    cwd: `${getVyrdxRoot()}/core`,
    env: { ...process.env, NODE_ENV: "production" },
  });

  const handle: ModuleHandle = {
    name,
    process: proc,
    startedAt: new Date().toISOString(),
    exitCode: null,
  };

  proc.on("exit", (code) => {
    handle.exitCode = code ?? -1;
    handle.process = null;
  });

  proc.on("error", (err) => {
    handle.exitCode = -1;
    handle.process = null;
    console.error(`[VYRDX] Module ${name} error:`, err.message);
  });

  moduleHandles.set(name, handle);
  return handle;
}

export function stopModule(name: VyrdxModuleName): boolean {
  const handle = moduleHandles.get(name);
  if (!handle?.process) return false;

  handle.process.kill("SIGTERM");
  return true;
}

export function stopAllModules(): void {
  for (const name of MODULE_NAMES) {
    stopModule(name);
  }
}
