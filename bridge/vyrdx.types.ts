/**
 * VYRDX Runtime Type Definitions
 * TypeScript types for /opt/vyrdx JavaScript runtime state
 */

export interface MarketModel {
  symbol: string;
  source: string;
  price: number;
  median: number;
  returnWindow: number;
  volatility: number;
  samples: number;
  ts: number;
  updatedAt: string;
}

export interface ServiceCheck {
  ok: boolean;
  ms: number;
  error?: string;
}

export interface SystemHealth {
  services: {
    db: ServiceCheck;
    redis: ServiceCheck;
    chain: ServiceCheck;
    feed: ServiceCheck;
    healthScore: number;
  };
  updatedAt: string;
}

export interface IntegrityBaseline {
  dbLatencyMsMax: number;
  redisLatencyMsMax: number;
  feedLatencyMsMax: number;
  chainLatencyMsMax: number;
  updatedAt: string;
}

export interface SecurityState {
  chainOk: boolean;
  repeatedEvents: number;
  journalLines: number;
  chainLines: number;
  severity: "LOW" | "HIGH" | "CRITICAL";
  updatedAt: string;
}

export interface AnalyticsState {
  deterministic: number;
  statistical: number;
  hybrid: number;
  recommendedMode: "OPPORTUNITY_SCAN" | "DEFENSIVE";
  updatedAt: string;
}

export interface RiskProfile {
  security?: SecurityState;
  analytics?: AnalyticsState;
  ts: number;
}

export interface SupervisionState {
  streamLen: number;
  dbCount: number;
  divergence: number;
  rssMb: number;
  status: "STABLE" | "HIGH_DRIFT";
  severity: "LOW" | "HIGH" | "CRITICAL";
  updatedAt: string;
}

export interface LearningMemory {
  security?: SecurityState;
  supervision?: SupervisionState;
  updatedAt: string;
}

export interface CacheTick {
  price: number;
  ts: number;
}

export interface CacheEvent {
  event: string;
  severity: "LOW" | "HIGH" | "CRITICAL";
  ts: number;
}

export interface AnomalyFlag {
  type: string;
  severity: "LOW" | "HIGH" | "CRITICAL";
  ts: number;
}

export interface RuntimeCache {
  ticks: CacheTick[];
  events: CacheEvent[];
  anomalyFlags: AnomalyFlag[];
  updatedAt: string;
}

export interface OpportunityItem {
  id: string;
  type: string;
  score: number;
  ts: number;
}

export interface OpportunityLog {
  items: OpportunityItem[];
}

export interface VyrdxConfig {
  max_memory_mb: number;
  max_runtime_cache_entries: number;
  max_opportunity_history: number;
  log_rotation_mb: number;
  paths: {
    journalLog: string;
    journalChain: string;
    logFile: string;
  };
}

export interface VyrdxDirective {
  execution_authority: boolean;
  private_key_access: boolean;
}

export interface VyrdxLaw {
  rule_1?: string;
  rule_2?: string;
  rule_3?: string;
  rule_4?: string;
  rule_5?: string;
  rule_6?: string;
  rule_7?: string;
}

export type VyrdxModuleName =
  | "analytics"
  | "hardware"
  | "health"
  | "market"
  | "opportunity"
  | "security"
  | "supervision";

export interface VyrdxModuleStatus {
  name: VyrdxModuleName;
  running: boolean;
  lastCheck: string;
  error?: string;
}
