/**
 * VYRDX State Readers
 * TypeScript bridge for reading /opt/vyrdx runtime state
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import type {
  MarketModel,
  SystemHealth,
  IntegrityBaseline,
  RiskProfile,
  LearningMemory,
  RuntimeCache,
  OpportunityLog,
  VyrdxConfig,
  VyrdxDirective,
  VyrdxLaw,
} from "./vyrdx.types.js";

const VYRDX_ROOT = process.env.VYRDX_ROOT || "/opt/vyrdx";
const STATE_DIR = `${VYRDX_ROOT}/core/state`;
const CONFIG_DIR = `${VYRDX_ROOT}/core/config`;

async function readJsonSafe<T>(path: string, fallback: T): Promise<T> {
  if (!existsSync(path)) return fallback;
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function readMarketModel(): Promise<MarketModel | null> {
  return readJsonSafe<MarketModel | null>(`${STATE_DIR}/market-model.json`, null);
}

export async function readSystemHealth(): Promise<SystemHealth | null> {
  return readJsonSafe<SystemHealth | null>(`${STATE_DIR}/system-health.json`, null);
}

export async function readIntegrityBaseline(): Promise<IntegrityBaseline | null> {
  return readJsonSafe<IntegrityBaseline | null>(`${STATE_DIR}/integrity-baseline.json`, null);
}

export async function readRiskProfile(): Promise<RiskProfile | null> {
  return readJsonSafe<RiskProfile | null>(`${STATE_DIR}/risk-profile.json`, null);
}

export async function readLearningMemory(): Promise<LearningMemory | null> {
  return readJsonSafe<LearningMemory | null>(`${STATE_DIR}/learning-memory.json`, null);
}

export async function readRuntimeCache(): Promise<RuntimeCache> {
  return readJsonSafe<RuntimeCache>(`${STATE_DIR}/runtime.cache`, {
    ticks: [],
    events: [],
    anomalyFlags: [],
    updatedAt: "",
  });
}

export async function readOpportunityLog(): Promise<OpportunityLog> {
  return readJsonSafe<OpportunityLog>(`${STATE_DIR}/opportunity-log.json`, { items: [] });
}

export async function readVyrdxConfig(): Promise<VyrdxConfig | null> {
  return readJsonSafe<VyrdxConfig | null>(`${CONFIG_DIR}/vyrdox-supervisor.json`, null);
}

export async function readVyrdxDirective(): Promise<VyrdxDirective | null> {
  return readJsonSafe<VyrdxDirective | null>(`${CONFIG_DIR}/vyrdox-directive.json`, null);
}

export async function readVyrdxLaw(): Promise<VyrdxLaw | null> {
  return readJsonSafe<VyrdxLaw | null>(`${CONFIG_DIR}/vyrdox-law.json`, null);
}

export interface VyrdxStateSnapshot {
  market: MarketModel | null;
  health: SystemHealth | null;
  risk: RiskProfile | null;
  learning: LearningMemory | null;
  cache: RuntimeCache;
  opportunities: OpportunityLog;
  ts: number;
}

export async function readFullState(): Promise<VyrdxStateSnapshot> {
  const [market, health, risk, learning, cache, opportunities] = await Promise.all([
    readMarketModel(),
    readSystemHealth(),
    readRiskProfile(),
    readLearningMemory(),
    readRuntimeCache(),
    readOpportunityLog(),
  ]);

  return {
    market,
    health,
    risk,
    learning,
    cache,
    opportunities,
    ts: Date.now(),
  };
}

export function isVyrdxAccessible(): boolean {
  return existsSync(VYRDX_ROOT) && existsSync(STATE_DIR);
}

export function getVyrdxRoot(): string {
  return VYRDX_ROOT;
}
