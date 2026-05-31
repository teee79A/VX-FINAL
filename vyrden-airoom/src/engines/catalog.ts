// VYRDON AI Room Engine Catalog
// 86 engines — vyrden.com

import type { AgentId } from '../core/types.js';

export type EngineType =
  | 'security'
  | 'financial'
  | 'strategy'
  | 'engineering'
  | 'infra'
  | 'business'
  | 'director'
  | 'commerce'
  | 'marketing'
  | 'server';

export type EngineCategory =
  | 'core'
  | 'offensive'
  | 'defensive'
  | 'scan'
  | 'audit'
  | 'ops'
  | 'blockchain'
  | 'analysis'
  | 'policy'
  | 'compliance'
  | 'reporting'
  | 'build'
  | 'quality'
  | 'security'
  | 'container'
  | 'service'
  | 'network'
  | 'monitoring'
  | 'backup'
  | 'deploy'
  | 'intelligence'
  | 'legal'
  | 'comms'
  | 'evaluation'
  | 'planning'
  | 'memory'
  | 'routing'
  | 'coordination'
  | 'governance'
  | 'scheduling'
  | 'transaction'
  | 'logistics'
  | 'billing'
  | 'content'
  | 'social'
  | 'growth'
  | 'brand';

export interface EngineSpec {
  readonly type: EngineType;
  readonly cat: EngineCategory;
  readonly desc: string;
  readonly owner: AgentId;
}

export type EngineId = keyof typeof ENGINE_CATALOG;

export const ENGINE_CATALOG = {
  // SECURITY (SEC-1 / ABYSSAL)
  'engine:blackhat': { type: 'security', cat: 'offensive', desc: 'Offensive security simulation', owner: 'SEC-1' },
  'engine:redhat': { type: 'security', cat: 'defensive', desc: 'Defensive posture analysis', owner: 'SEC-1' },
  'engine:perimeter-scan': { type: 'security', cat: 'scan', desc: 'Network perimeter audit', owner: 'SEC-1' },
  'engine:injection-audit': { type: 'security', cat: 'audit', desc: 'Prompt injection testing', owner: 'SEC-1' },
  'engine:key-rotation': { type: 'security', cat: 'ops', desc: 'Secret rotation enforcement', owner: 'SEC-1' },
  'engine:wallet-allowlist': { type: 'security', cat: 'blockchain', desc: 'Wallet allowlist validation', owner: 'SEC-1' },
  'engine:threat-model': { type: 'security', cat: 'analysis', desc: 'Attack surface mapping', owner: 'SEC-1' },
  'engine:vuln-scanner': { type: 'security', cat: 'scan', desc: 'Dependency vulnerability scan', owner: 'SEC-1' },
  'engine:access-control': { type: 'security', cat: 'policy', desc: 'RBAC enforcement', owner: 'SEC-1' },
  'engine:incident-response': { type: 'security', cat: 'ops', desc: 'Incident triage and response', owner: 'SEC-1' },

  // FINANCIAL (CFO-1 / LEVERAGE)
  'engine:cfo-core': { type: 'financial', cat: 'core', desc: 'Financial reasoning engine', owner: 'CFO-1' },
  'engine:treasury': { type: 'financial', cat: 'ops', desc: 'Treasury and fund allocation', owner: 'CFO-1' },
  'engine:gas-optimizer': { type: 'financial', cat: 'blockchain', desc: 'Gas fee optimization', owner: 'CFO-1' },
  'engine:escrow-monitor': { type: 'financial', cat: 'blockchain', desc: 'EscrowVault state monitoring', owner: 'CFO-1' },
  'engine:burn-rate': { type: 'financial', cat: 'analysis', desc: 'Burn rate calculation', owner: 'CFO-1' },
  'engine:runway-projection': { type: 'financial', cat: 'analysis', desc: 'Runway projection', owner: 'CFO-1' },
  'engine:invoice-processor': { type: 'financial', cat: 'ops', desc: 'Invoice processing', owner: 'CFO-1' },
  'engine:tax-engine': { type: 'financial', cat: 'compliance', desc: 'Tax obligation tracking', owner: 'CFO-1' },
  'engine:payroll': { type: 'financial', cat: 'ops', desc: 'Payroll management', owner: 'CFO-1' },
  'engine:financial-reporting': { type: 'financial', cat: 'reporting', desc: 'Financial report generation', owner: 'CFO-1' },

  // STRATEGY (REV-1 / MAMMON)
  'engine:ceo-core': { type: 'strategy', cat: 'core', desc: 'Strategic reasoning engine', owner: 'REV-1' },
  'engine:revenue-model': { type: 'strategy', cat: 'analysis', desc: 'Revenue model iteration', owner: 'REV-1' },
  'engine:partnership-eval': { type: 'strategy', cat: 'evaluation', desc: 'Partnership scoring', owner: 'REV-1' },
  'engine:gtm-strategy': { type: 'strategy', cat: 'planning', desc: 'Go-to-market planning', owner: 'REV-1' },
  'engine:investor-relations': { type: 'strategy', cat: 'comms', desc: 'Investor communications', owner: 'REV-1' },
  'engine:board-reporting': { type: 'strategy', cat: 'reporting', desc: 'Board-level reporting', owner: 'REV-1' },
  'engine:okr-tracker': { type: 'strategy', cat: 'ops', desc: 'OKR tracking and scoring', owner: 'REV-1' },
  'engine:decision-journal': { type: 'strategy', cat: 'memory', desc: 'Decision logging', owner: 'REV-1' },
  'engine:scenario-planner': { type: 'strategy', cat: 'analysis', desc: 'Scenario modeling', owner: 'REV-1' },
  'engine:competitive-response': { type: 'strategy', cat: 'intelligence', desc: 'Competitive response', owner: 'REV-1' },

  // ENGINEERING (ENG-1 / OBSIDIAN)
  'engine:eng-core': { type: 'engineering', cat: 'core', desc: 'Engineering reasoning', owner: 'ENG-1' },
  'engine:module-builder': { type: 'engineering', cat: 'build', desc: 'VYRDX module building', owner: 'ENG-1' },
  'engine:contract-deployer': { type: 'engineering', cat: 'blockchain', desc: 'Smart contract deployment', owner: 'ENG-1' },
  'engine:attestation-engine': { type: 'engineering', cat: 'blockchain', desc: 'Attestation token lifecycle', owner: 'ENG-1' },
  'engine:seal-engine': { type: 'engineering', cat: 'blockchain', desc: 'ExecutionSeal interaction', owner: 'ENG-1' },
  'engine:hash-anchor': { type: 'engineering', cat: 'blockchain', desc: 'State hash anchoring', owner: 'ENG-1' },
  'engine:code-review': { type: 'engineering', cat: 'quality', desc: 'Automated code review', owner: 'ENG-1' },
  'engine:test-runner': { type: 'engineering', cat: 'quality', desc: 'Test execution', owner: 'ENG-1' },
  'engine:dependency-audit': { type: 'engineering', cat: 'security', desc: 'Dependency auditing', owner: 'ENG-1' },
  'engine:refactor-engine': { type: 'engineering', cat: 'build', desc: 'Deterministic refactoring', owner: 'ENG-1' },
  'engine:schema-validator': { type: 'engineering', cat: 'quality', desc: 'Schema validation', owner: 'ENG-1' },
  'engine:migration-runner': { type: 'engineering', cat: 'ops', desc: 'Migration execution', owner: 'ENG-1' },

  // INFRASTRUCTURE (ENG-2 / THUNDER)
  'engine:infra-core': { type: 'infra', cat: 'core', desc: 'Infrastructure reasoning', owner: 'ENG-2' },
  'engine:ci-pipeline': { type: 'infra', cat: 'build', desc: 'CI/CD pipeline management', owner: 'ENG-2' },
  'engine:docker-manager': { type: 'infra', cat: 'container', desc: 'Docker orchestration', owner: 'ENG-2' },
  'engine:systemd-manager': { type: 'infra', cat: 'service', desc: 'Systemd unit management', owner: 'ENG-2' },
  'engine:nginx-config': { type: 'infra', cat: 'network', desc: 'Nginx configuration', owner: 'ENG-2' },
  'engine:cloudflared-tunnel': { type: 'infra', cat: 'network', desc: 'Cloudflare Tunnel lifecycle', owner: 'ENG-2' },
  'engine:tailscale-bridge': { type: 'infra', cat: 'network', desc: 'Tailscale mesh management', owner: 'ENG-2' },
  'engine:healthcheck': { type: 'infra', cat: 'monitoring', desc: 'Service health monitoring', owner: 'ENG-2' },
  'engine:log-collector': { type: 'infra', cat: 'monitoring', desc: 'Log aggregation', owner: 'ENG-2' },
  'engine:snapshot-manager': { type: 'infra', cat: 'backup', desc: 'Snapshot management', owner: 'ENG-2' },
  'engine:rollback-engine': { type: 'infra', cat: 'ops', desc: 'Rollback execution', owner: 'ENG-2' },
  'engine:canary-deploy': { type: 'infra', cat: 'deploy', desc: 'Canary deployment', owner: 'ENG-2' },

  // BUSINESS (BIZ-1 / TITAN)
  'engine:biz-core': { type: 'business', cat: 'core', desc: 'Business intelligence reasoning', owner: 'BIZ-1' },
  'engine:market-scanner': { type: 'business', cat: 'intelligence', desc: 'Market trend scanning', owner: 'BIZ-1' },
  'engine:competitor-tracker': { type: 'business', cat: 'intelligence', desc: 'Competitor monitoring', owner: 'BIZ-1' },
  'engine:ip-portfolio': { type: 'business', cat: 'legal', desc: 'IP portfolio tracking', owner: 'BIZ-1' },
  'engine:investor-brief': { type: 'business', cat: 'comms', desc: 'Investor brief generation', owner: 'BIZ-1' },
  'engine:pitch-builder': { type: 'business', cat: 'comms', desc: 'Pitch deck structuring', owner: 'BIZ-1' },
  'engine:crm-engine': { type: 'business', cat: 'ops', desc: 'Contact management', owner: 'BIZ-1' },
  'engine:lead-scorer': { type: 'business', cat: 'ops', desc: 'Lead scoring', owner: 'BIZ-1' },
  'engine:email-outreach': { type: 'business', cat: 'comms', desc: 'Outbound campaigns', owner: 'BIZ-1' },
  'engine:analytics-dashboard': { type: 'business', cat: 'reporting', desc: 'Metrics aggregation', owner: 'BIZ-1' },

  // DIRECTOR (DIR-1 / VYRDOX)
  'engine:director-core': { type: 'director', cat: 'core', desc: 'Orchestration reasoning', owner: 'DIR-1' },
  'engine:task-router': { type: 'director', cat: 'routing', desc: 'Task classification and routing', owner: 'DIR-1' },
  'engine:agent-sync': { type: 'director', cat: 'coordination', desc: 'Cross-agent sync', owner: 'DIR-1' },
  'engine:queue-manager': { type: 'director', cat: 'ops', desc: 'Queue management', owner: 'DIR-1' },
  'engine:certification-pipeline': { type: 'director', cat: 'governance', desc: 'VYRDX CERTIFIED TRUE pipeline', owner: 'DIR-1' },
  'engine:escalation-handler': { type: 'director', cat: 'ops', desc: 'Escalation routing', owner: 'DIR-1' },
  'engine:priority-engine': { type: 'director', cat: 'ops', desc: 'Priority calculation', owner: 'DIR-1' },
  'engine:dependency-resolver': { type: 'director', cat: 'coordination', desc: 'Task dependency resolution', owner: 'DIR-1' },
  'engine:broadcast-engine': { type: 'director', cat: 'comms', desc: 'System-wide broadcast', owner: 'DIR-1' },
  'engine:schedule-engine': { type: 'director', cat: 'ops', desc: 'Scheduled execution', owner: 'DIR-1' },
  'engine:conflict-resolver': { type: 'director', cat: 'coordination', desc: 'Resource conflict resolution', owner: 'DIR-1' },
  'engine:sla-monitor': { type: 'director', cat: 'monitoring', desc: 'SLA compliance tracking', owner: 'DIR-1' },

  // COMMERCE (shared — routed through TITAN)
  'engine:storefront': { type: 'commerce', cat: 'core', desc: 'Product catalog management', owner: 'BIZ-1' },
  'engine:checkout': { type: 'commerce', cat: 'transaction', desc: 'Payment processing', owner: 'BIZ-1' },
  'engine:inventory': { type: 'commerce', cat: 'ops', desc: 'Inventory tracking', owner: 'BIZ-1' },
  'engine:shipping': { type: 'commerce', cat: 'logistics', desc: 'Fulfillment and shipping', owner: 'BIZ-1' },
  'engine:subscription': { type: 'commerce', cat: 'billing', desc: 'Subscription lifecycle', owner: 'BIZ-1' },
  'engine:refund': { type: 'commerce', cat: 'ops', desc: 'Refund and disputes', owner: 'BIZ-1' },
  'engine:pricing': { type: 'commerce', cat: 'analysis', desc: 'Dynamic pricing', owner: 'BIZ-1' },
  'engine:customer-support': { type: 'commerce', cat: 'ops', desc: 'Customer inquiry routing', owner: 'BIZ-1' },

  // MARKETING (CMO — routed through MAMMON for strategy)
  'engine:cmo-core': { type: 'marketing', cat: 'core', desc: 'Marketing strategy reasoning', owner: 'REV-1' },
  'engine:content-engine': { type: 'marketing', cat: 'content', desc: 'Content creation and scheduling', owner: 'REV-1' },
  'engine:social-engine': { type: 'marketing', cat: 'social', desc: 'Social media management', owner: 'REV-1' },
  'engine:seo-engine': { type: 'marketing', cat: 'growth', desc: 'SEO optimization', owner: 'REV-1' },
  'engine:brand-engine': { type: 'marketing', cat: 'brand', desc: 'Brand consistency enforcement', owner: 'REV-1' },
  'engine:campaign-engine': { type: 'marketing', cat: 'ops', desc: 'Campaign execution', owner: 'REV-1' },

  // SERVER / OPENSHELL (routed through THUNDER for infra)
  'engine:openshell': { type: 'server', cat: 'core', desc: 'Sandboxed shell execution', owner: 'ENG-2' },
  'engine:agent-gateway': { type: 'server', cat: 'network', desc: 'Agent-to-agent message bus', owner: 'ENG-2' },
  'engine:process-manager': { type: 'server', cat: 'ops', desc: 'Process lifecycle management', owner: 'ENG-2' },
  'engine:file-watcher': { type: 'server', cat: 'monitoring', desc: 'Filesystem event dispatch', owner: 'ENG-2' },
  'engine:cron-engine': { type: 'server', cat: 'scheduling', desc: 'Scheduled job execution', owner: 'ENG-2' },
  'engine:webhook-receiver': { type: 'server', cat: 'network', desc: 'Inbound webhook routing', owner: 'ENG-2' },
  'engine:socket-bridge': { type: 'server', cat: 'network', desc: 'WebSocket bridge', owner: 'ENG-2' },
  'engine:backup-engine': { type: 'server', cat: 'backup', desc: 'Automated backup to R2', owner: 'ENG-2' },
} as const satisfies Record<string, EngineSpec>;

export const ENGINE_COUNT = Object.keys(ENGINE_CATALOG).length as 86;

export function getEngineSpec(id: EngineId): EngineSpec {
  return ENGINE_CATALOG[id];
}

export function getEnginesByOwner(owner: AgentId): readonly EngineId[] {
  return (Object.entries(ENGINE_CATALOG) as [EngineId, EngineSpec][])
    .filter(([, spec]) => spec.owner === owner)
    .map(([id]) => id);
}

export function getEnginesByType(type: EngineType): readonly EngineId[] {
  return (Object.entries(ENGINE_CATALOG) as [EngineId, EngineSpec][])
    .filter(([, spec]) => spec.type === type)
    .map(([id]) => id);
}

export function getEnginesByCategory(cat: EngineCategory): readonly EngineId[] {
  return (Object.entries(ENGINE_CATALOG) as [EngineId, EngineSpec][])
    .filter(([, spec]) => spec.cat === cat)
    .map(([id]) => id);
}

export function getAllEngineIds(): readonly EngineId[] {
  return Object.keys(ENGINE_CATALOG) as EngineId[];
}

export function isValidEngineId(id: string): id is EngineId {
  return id in ENGINE_CATALOG;
}
