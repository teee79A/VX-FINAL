import {
  AccessControl,
  AttestationEngine,
  BackupEngine,
  Blackhat,
  BroadcastEngine,
  BurnRate,
  CanaryDeploy,
  CertificationPipeline,
  CIPipeline,
  CloudflaredTunnel,
  CodeReview,
  ComplianceMonitor,
  ContractDeployer,
  CfoCore,
  CronEngine,
  DataPipe,
  DependencyAudit,
  DirectorCore,
  DockerManager,
  EngCore,
  EscrowMonitor,
  EscalationHandler,
  EventBus,
  FileWatcher,
  FinancialReporting,
  GasOptimizer,
  getEngineCount,
  HashAnchor,
  Healthcheck,
  IncidentResponse,
  InfraCore,
  InjectionAudit,
  InvoiceProcessor,
  KeyRotation,
  LegalHold,
  LogCollector,
  MigrationRunner,
  ModuleBuilder,
  MultiSigOrchestrator,
  NginxConfig,
  OpenShell,
  Payroll,
  PerimeterScan,
  ProcessManager,
  QueueManager,
  Redhat,
  RefactorEngine,
  RiskRegister,
  RollbackEngine,
  RunwayProjection,
  ScheduleEngine,
  SealEngine,
  SchemaValidator,
  SnapshotManager,
  SocketBridge,
  StateSync,
  SystemdManager,
  TailscaleBridge,
  TaskRouter,
  TaxEngine,
  TestRunner,
  ThreatModel,
  Treasury,
  TriggerEngine,
  Transformer,
  VulnScanner,
  WalletAllowlist,
  WebhookReceiver,
} from './index.js';
import {
  bootCeoEngineLayers,
  bootCeoServerLayers,
  createCeoTopologySnapshot,
} from './ceo/index.js';
import type { Engine, EngineCategory } from './types.js';
import type {
  CeoLayerEngine,
  CeoServerNode,
} from './ceo/index.js';
import type {
  EventBus as EventBusEngine,
  DataPipe as DataPipeEngine,
  StateSync as StateSyncEngine,
  TriggerEngine as TriggerEngineEngine,
} from './interconnect/index.js';

export const ENGINE_GROUP_ORDER = [
  'interconnect',
  'security',
  'engineering',
  'infra',
  'financial',
  'director',
  'server',
  'governance',
  'ceo_engine_layer',
  'ceo_server_layer',
] as const;

export type StationEngineGroupId = (typeof ENGINE_GROUP_ORDER)[number];

export interface EngineGroupSnapshot {
  group: StationEngineGroupId;
  total: number;
  ids: string[];
  types: EngineCategory[];
}

export interface StationBootWiring {
  eventBusId: string;
  dataPipeId: string;
  stateSyncId: string;
  triggerEngineId: string;
  emittersWired: number;
  feedEdges: Array<{
    pipeId: string;
    source: string;
    sink: string;
    resolved: boolean;
  }>;
  unresolvedTargets: string[];
}

export interface StationBootSnapshot {
  station: {
    total: number;
    byType: Record<string, number>;
  };
  groups: EngineGroupSnapshot[];
  wiring: StationBootWiring;
  ceo: ReturnType<typeof createCeoTopologySnapshot>;
}

export interface StationBootResult {
  groups: Map<StationEngineGroupId, Engine[]>;
  engines: Map<string, Engine>;
  snapshot: StationBootSnapshot;
}

const EXTERNAL_RUNTIME_SINKS = new Set(['radar', 'tenderly']);

const ENGINE_GROUP_BUILDERS: Record<StationEngineGroupId, () => Engine[]> = {
  interconnect: () => [
    new EventBus(),
    new DataPipe(),
    new StateSync(),
    new TriggerEngine(),
    new Transformer(),
  ],
  security: () => [
    new Blackhat(),
    new Redhat(),
    new PerimeterScan(),
    new InjectionAudit(),
    new KeyRotation(),
    new WalletAllowlist(),
    new ThreatModel(),
    new VulnScanner(),
    new AccessControl(),
    new IncidentResponse(),
  ],
  engineering: () => [
    new EngCore(),
    new ModuleBuilder(),
    new ContractDeployer(),
    new AttestationEngine(),
    new SealEngine(),
    new HashAnchor(),
    new CodeReview(),
    new TestRunner(),
    new DependencyAudit(),
    new SchemaValidator(),
    new MigrationRunner(),
    new RefactorEngine(),
  ],
  infra: () => [
    new InfraCore(),
    new CIPipeline(),
    new DockerManager(),
    new SystemdManager(),
    new NginxConfig(),
    new CloudflaredTunnel(),
    new TailscaleBridge(),
    new Healthcheck(),
    new LogCollector(),
    new SnapshotManager(),
    new RollbackEngine(),
    new CanaryDeploy(),
  ],
  financial: () => [
    new CfoCore(),
    new Treasury(),
    new GasOptimizer(),
    new EscrowMonitor(),
    new BurnRate(),
    new RunwayProjection(),
    new InvoiceProcessor(),
    new TaxEngine(),
    new Payroll(),
    new FinancialReporting(),
    new MultiSigOrchestrator(),
  ],
  director: () => [
    new DirectorCore(),
    new TaskRouter(),
    new QueueManager(),
    new CertificationPipeline(),
    new EscalationHandler(),
    new BroadcastEngine(),
    new ScheduleEngine(),
  ],
  server: () => [
    new OpenShell(),
    new ProcessManager(),
    new FileWatcher(),
    new CronEngine(),
    new WebhookReceiver(),
    new SocketBridge(),
    new BackupEngine(),
  ],
  governance: () => [
    new ComplianceMonitor(),
    new RiskRegister(),
    new LegalHold(),
  ],
  ceo_engine_layer: () => [...bootCeoEngineLayers().values()],
  ceo_server_layer: () => [...bootCeoServerLayers().values()],
};

function buildEngineGroups(): Map<StationEngineGroupId, Engine[]> {
  const groups = new Map<StationEngineGroupId, Engine[]>();
  for (const group of ENGINE_GROUP_ORDER) {
    groups.set(group, ENGINE_GROUP_BUILDERS[group]());
  }
  return groups;
}

function buildEngineMap(groups: Map<StationEngineGroupId, Engine[]>): Map<string, Engine> {
  const engines = new Map<string, Engine>();
  for (const group of ENGINE_GROUP_ORDER) {
    for (const engine of groups.get(group) ?? []) {
      engines.set(engine.id, engine);
    }
  }
  return engines;
}

function wireInterconnect(engines: Map<string, Engine>): StationBootWiring {
  const eventBus = engines.get('event_bus') as EventBusEngine | undefined;
  const dataPipe = engines.get('data_pipe') as DataPipeEngine | undefined;
  const stateSync = engines.get('state_sync') as StateSyncEngine | undefined;
  const triggerEngine = engines.get('trigger_engine') as TriggerEngineEngine | undefined;

  if (!eventBus || !dataPipe || !stateSync || !triggerEngine) {
    throw new Error('interconnect spine is incomplete');
  }

  const feedEdges: StationBootWiring['feedEdges'] = [];
  const unresolvedTargets = new Set<string>();
  let emittersWired = 0;

  for (const engine of engines.values()) {
    engine.onEvent = (event) => eventBus.publish(event);
    emittersWired += 1;

    for (const target of engine.feeds ?? []) {
      const pipeId = `${engine.id}->${target}`;
      const resolved = engines.has(target) || EXTERNAL_RUNTIME_SINKS.has(target);
      dataPipe.register(pipeId, engine.id, target);
      if (!resolved) {
        unresolvedTargets.add(target);
      }
      feedEdges.push({ pipeId, source: engine.id, sink: target, resolved });
    }
  }

  return {
    eventBusId: eventBus.id,
    dataPipeId: dataPipe.id,
    stateSyncId: stateSync.id,
    triggerEngineId: triggerEngine.id,
    emittersWired,
    feedEdges,
    unresolvedTargets: [...unresolvedTargets].sort(),
  };
}

function createGroupSnapshots(groups: Map<StationEngineGroupId, Engine[]>): EngineGroupSnapshot[] {
  return ENGINE_GROUP_ORDER.map((group) => {
    const engines = groups.get(group) ?? [];
    return {
      group,
      total: engines.length,
      ids: engines.map((engine) => engine.id),
      types: [...new Set(engines.map((engine) => engine.type))],
    };
  });
}

export function createBootSnapshot(
  groups: Map<StationEngineGroupId, Engine[]>,
  engines: Map<string, Engine>,
  wiring: StationBootWiring,
): StationBootSnapshot {
  const ceoEngines = new Map(
    (groups.get('ceo_engine_layer') ?? []).map((engine) => [(engine as CeoLayerEngine).layer, engine as CeoLayerEngine]),
  );
  const ceoServers = new Map(
    (groups.get('ceo_server_layer') ?? []).map((engine) => [(engine as CeoServerNode).serverLayer, engine as CeoServerNode]),
  );

  return {
    station: getEngineCount(engines),
    groups: createGroupSnapshots(groups),
    wiring,
    ceo: createCeoTopologySnapshot(ceoEngines, ceoServers),
  };
}

export function bootStation(): StationBootResult {
  const groups = buildEngineGroups();
  const engines = buildEngineMap(groups);
  const wiring = wireInterconnect(engines);

  return {
    groups,
    engines,
    snapshot: createBootSnapshot(groups, engines, wiring),
  };
}
