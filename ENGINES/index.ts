// ENGINES/index.ts
// This IS the engine registry. Not JSON. Not config. Code.
// Import what you need. Types enforce the contract.

// ── RE-EXPORTS ──────────────────────────────────────────
export * from './types.js';
export { BaseEngine } from './base.js';

// ── SECURITY ────────────────────────────────────────────
export { Blackhat, Redhat, PerimeterScan, InjectionAudit, KeyRotation, WalletAllowlist, ThreatModel, VulnScanner, AccessControl, IncidentResponse } from './security/index.js';

// ── ENGINEERING ─────────────────────────────────────────
export { EngCore, ModuleBuilder, ContractDeployer, AttestationEngine, SealEngine, HashAnchor, CodeReview, TestRunner, DependencyAudit, SchemaValidator, MigrationRunner, RefactorEngine } from './engineering/index.js';

// ── INFRA ───────────────────────────────────────────────
export { InfraCore, CIPipeline, DockerManager, SystemdManager, NginxConfig, CloudflaredTunnel, TailscaleBridge, Healthcheck, LogCollector, SnapshotManager, RollbackEngine, CanaryDeploy } from './infra/index.js';

// ── FINANCIAL ───────────────────────────────────────────
export { CfoCore, Treasury, GasOptimizer, EscrowMonitor, BurnRate, RunwayProjection, InvoiceProcessor, TaxEngine, Payroll, FinancialReporting, MultiSigOrchestrator } from './financial/index.js';

// ── DIRECTOR ────────────────────────────────────────────
export { DirectorCore, TaskRouter, QueueManager, CertificationPipeline, EscalationHandler, BroadcastEngine, ScheduleEngine } from './director/index.js';

// ── SERVER ──────────────────────────────────────────────
export { OpenShell, ProcessManager, FileWatcher, CronEngine, WebhookReceiver, SocketBridge, BackupEngine } from './server/index.js';

// ── INTERCONNECT ────────────────────────────────────────
export { EventBus, DataPipe, StateSync, TriggerEngine, Transformer } from './interconnect/index.js';

// ── GOVERNANCE ──────────────────────────────────────────
export { ComplianceMonitor, RiskRegister, LegalHold } from './governance/index.js';

// ── CEO TOPOLOGY ─────────────────────────────────────────
export {
  CEO_ENGINE_LAYER_ORDER,
  CEO_SERVER_LAYER_ORDER,
  OpsEngine,
  SystemEngine,
  PolicyEngine,
  TrustClosureEngine,
  SealReadinessEngine,
  CommercialEngine,
  MarketEngine,
  FeedbackAiEngine,
  EvidenceEngine,
  CampaignEngine,
  RuntimeApiServer,
  GatewayServer,
  McpRouterServer,
  ChatServer,
  VoiceServer,
  VectorServer,
  RagServer,
  EvidenceServer,
  RoomRunnerServer,
  ObservabilityServer,
  bootCeoEngineLayers,
  bootCeoServerLayers,
  createCeoTopologySnapshot,
} from './ceo/index.js';


// ═══════════════════════════════════════════════════════
// STATION BOOT — creates all engines, wires interconnects
// ═══════════════════════════════════════════════════════

import type { Engine } from './types.js';
import * as Security from './security/index.js';
import * as Engineering from './engineering/index.js';
import * as Infra from './infra/index.js';
import * as Financial from './financial/index.js';
import * as Director from './director/index.js';
import * as Server from './server/index.js';
import * as Interconnect from './interconnect/index.js';
import * as Governance from './governance/index.js';

export function bootAllEngines(): Map<string, Engine> {
  const engines = new Map<string, Engine>();

  // Interconnect first — they wire everything
  const eventBus = new Interconnect.EventBus();
  const dataPipe = new Interconnect.DataPipe();
  const stateSync = new Interconnect.StateSync();
  const triggerEngine = new Interconnect.TriggerEngine();
  const transformer = new Interconnect.Transformer();
  engines.set(eventBus.id, eventBus);
  engines.set(dataPipe.id, dataPipe);
  engines.set(stateSync.id, stateSync);
  engines.set(triggerEngine.id, triggerEngine);
  engines.set(transformer.id, transformer);

  // Security
  const securityEngines = [
    new Security.Blackhat(), new Security.Redhat(), new Security.PerimeterScan(),
    new Security.InjectionAudit(), new Security.KeyRotation(), new Security.WalletAllowlist(),
    new Security.ThreatModel(), new Security.VulnScanner(), new Security.AccessControl(),
    new Security.IncidentResponse(),
  ];
  securityEngines.forEach(e => engines.set(e.id, e));

  // Engineering
  const engEngines = [
    new Engineering.EngCore(), new Engineering.ModuleBuilder(), new Engineering.ContractDeployer(),
    new Engineering.AttestationEngine(), new Engineering.SealEngine(), new Engineering.HashAnchor(),
    new Engineering.CodeReview(), new Engineering.TestRunner(), new Engineering.DependencyAudit(),
    new Engineering.SchemaValidator(), new Engineering.MigrationRunner(), new Engineering.RefactorEngine(),
  ];
  engEngines.forEach(e => engines.set(e.id, e));

  // Infra
  const infraEngines = [
    new Infra.InfraCore(), new Infra.CIPipeline(), new Infra.DockerManager(),
    new Infra.SystemdManager(), new Infra.NginxConfig(), new Infra.CloudflaredTunnel(),
    new Infra.TailscaleBridge(), new Infra.Healthcheck(), new Infra.LogCollector(),
    new Infra.SnapshotManager(), new Infra.RollbackEngine(), new Infra.CanaryDeploy(),
  ];
  infraEngines.forEach(e => engines.set(e.id, e));

  // Financial
  const finEngines = [
    new Financial.CfoCore(), new Financial.Treasury(), new Financial.GasOptimizer(),
    new Financial.EscrowMonitor(), new Financial.BurnRate(), new Financial.RunwayProjection(),
    new Financial.InvoiceProcessor(), new Financial.TaxEngine(), new Financial.Payroll(),
    new Financial.FinancialReporting(), new Financial.MultiSigOrchestrator(),
  ];
  finEngines.forEach(e => engines.set(e.id, e));

  // Director
  const dirEngines = [
    new Director.DirectorCore(), new Director.TaskRouter(), new Director.QueueManager(),
    new Director.CertificationPipeline(), new Director.EscalationHandler(),
    new Director.BroadcastEngine(), new Director.ScheduleEngine(),
  ];
  dirEngines.forEach(e => engines.set(e.id, e));

  // Server
  const srvEngines = [
    new Server.OpenShell(), new Server.ProcessManager(), new Server.FileWatcher(),
    new Server.CronEngine(), new Server.WebhookReceiver(), new Server.SocketBridge(),
    new Server.BackupEngine(),
  ];
  srvEngines.forEach(e => engines.set(e.id, e));

  // Governance
  const govEngines = [
    new Governance.ComplianceMonitor(), new Governance.RiskRegister(), new Governance.LegalHold(),
  ];
  govEngines.forEach(e => engines.set(e.id, e));

  // Wire event bus — every engine that emits pushes through the bus
  for (const engine of engines.values()) {
    engine.onEvent = (event) => eventBus.publish(event);
  }

  // Wire feeds — register data pipes
  for (const engine of engines.values()) {
    if (engine.feeds) {
      for (const target of engine.feeds) {
        dataPipe.register(`${engine.id}->${target}`, engine.id, target);
      }
    }
  }

  return engines;
}

export function getEngineCount(engines: Map<string, Engine>) {
  const byType: Record<string, number> = {};
  for (const e of engines.values()) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
  }
  return { total: engines.size, byType };
}
