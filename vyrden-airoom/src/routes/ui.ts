import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getGateway } from '../ai/gateway.js';
import { authenticator } from '../middleware/authenticator.js';

type GatewayStats = Awaited<ReturnType<ReturnType<typeof getGateway>['getStats']>>;

interface DetailLayer {
  readonly name: string;
  readonly desc: string;
  readonly color: string;
}

interface RoomDefinition {
  readonly id: string;
  readonly icon: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly namespace: string;
  readonly deploy: string;
  readonly ingress: string;
  readonly plugin: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly layers: readonly DetailLayer[];
  readonly services: readonly string[];
  readonly responsibilities: readonly string[];
  readonly rules: readonly string[];
}

interface CoreDefinition {
  readonly id: string;
  readonly icon: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly namespace: string;
  readonly deploy: string;
  readonly ingress: string;
  readonly plugin: string;
  readonly layers: readonly DetailLayer[];
  readonly services: readonly string[];
  readonly responsibilities: readonly string[];
  readonly rules: readonly string[];
}

export interface SceneMeta {
  readonly pageTitle: string;
  readonly routeLabel: string;
  readonly hint: string;
}

const ROOM_DEFINITIONS: readonly RoomDefinition[] = [
  {
    id: 'vyrdx-commercial',
    icon: '◈',
    title: 'Commercial',
    subtitle: 'Public product and business execution',
    description:
      'Public product surface, customer flows, billing, webhooks, notifications, and commercial evidence emission live here. It is the public business lane but still evidence-bound.',
    namespace: 'vyrdx-commercial',
    deploy: 'DigitalOcean droplet / public edge',
    ingress: 'Public ingress allowed',
    plugin: 'Grab + open',
    x: -430,
    y: -165,
    z: 90,
    layers: [
      { name: 'web', desc: 'One-page product surface and customer entry', color: '#ff7a2f' },
      { name: 'api', desc: 'Customer and subscription APIs', color: '#ff9b2f' },
      { name: 'billing', desc: 'Purchase and recurring billing flows', color: '#ffd15c' },
      { name: 'webhooks', desc: 'Payment provider verification lane', color: '#ff4a36' },
      { name: 'receipts', desc: 'Invoice and receipt output', color: '#ffb366' },
      { name: 'notifications', desc: 'Outbound notifications', color: '#ff8f52' },
      { name: 'events', desc: 'Commercial event stream', color: '#ff6633' },
      { name: 'evidence-outbox', desc: 'Approved evidence handoff only', color: '#ff9352' },
      { name: 'policy', desc: 'Ingress and payment policy checks', color: '#ffca72' },
      { name: 'ops', desc: 'Commercial operational controls', color: '#ffad54' },
    ],
    services: [
      'commercial-web',
      'commercial-api',
      'billing-api',
      'payment-webhook',
      'receipt-worker',
      'smtp-worker',
    ],
    responsibilities: [
      'customer and account flows',
      'subscription and purchase flows',
      'payment provider session creation',
      'invoice and receipt generation',
      'webhook verification',
      'notification delivery',
      'commercial evidence emission',
    ],
    rules: [
      'public ingress allowed',
      'no direct Evidence DB writes',
      'no direct AI exposure',
      'all payment and receipt events go through evidence-approved path',
    ],
  },
  {
    id: 'vyrdx-evidence-public',
    icon: '◇',
    title: 'Evidence Public',
    subtitle: 'Public proof surface',
    description:
      'Public verification lives here. This room can expose proof metadata, manifests, and verification paths, but never raw artifacts, signer internals, or private audit data.',
    namespace: 'vyrdx-evidence-public',
    deploy: 'DigitalOcean droplet / public edge',
    ingress: 'Public ingress allowed',
    plugin: 'Grab + verify',
    x: -160,
    y: -275,
    z: 60,
    layers: [
      { name: 'proof-api', desc: 'Proof metadata publication', color: '#52dbff' },
      { name: 'verification-api', desc: 'External verification entrypoint', color: '#00c8ff' },
      { name: 'manifests', desc: 'Proof manifest envelopes', color: '#4ea8ff' },
      { name: 'attestation-registry', desc: 'Attestation reference index', color: '#76e3ff' },
      { name: 'ops', desc: 'Public proof operational controls', color: '#87f4ff' },
    ],
    services: ['proof-api', 'verification-api'],
    responsibilities: [
      'proof metadata publication',
      'external verification responses',
      'manifest browsing',
      'attestation lookup',
    ],
    rules: [
      'public ingress allowed',
      'proof metadata only',
      'no raw artifacts',
      'no private audit data',
      'no signer exposure',
    ],
  },
  {
    id: 'vyrdx-evidence-private',
    icon: '◆',
    title: 'Evidence Private',
    subtitle: 'Immutable internal evidence engine',
    description:
      'Append-only journals, manifest workers, signer isolation, artifact storage, and chain-of-custody handling live here. It is private, immutable, and proof-safe by design.',
    namespace: 'vyrdx-evidence-private',
    deploy: 'DigitalOcean droplet / private lane',
    ingress: 'No public ingress',
    plugin: 'Grab + inspect',
    x: 170,
    y: -245,
    z: 130,
    layers: [
      { name: 'journal', desc: 'Append-only evidence journal', color: '#6de2ff' },
      { name: 'hash-workers', desc: 'Three-hash path preservation', color: '#1cc2ff' },
      { name: 'manifest-workers', desc: 'Manifest production and sealing', color: '#0092ff' },
      { name: 'signer', desc: 'Isolated attestation signer lane', color: '#0068c9' },
      { name: 'artifact-store', desc: 'Internal custody store', color: '#79ecff' },
      { name: 'audit', desc: 'Private audit review', color: '#57b6ff' },
      { name: 'chain-of-custody', desc: 'Artifact lineage and handoff proof', color: '#3f8cff' },
      { name: 'ops', desc: 'Private evidence operations', color: '#8bdcff' },
    ],
    services: ['hash-worker', 'manifest-worker', 'attestation-signer', 'journal-writer'],
    responsibilities: [
      'append-only evidence writes',
      'manifest production',
      'attestation signing',
      'artifact custody',
      'private audit trail preservation',
    ],
    rules: [
      'no public ingress',
      'append-only design',
      'signer isolated',
      'proof-only outward publication',
      'three-hash path preserved',
    ],
  },
  {
    id: 'vyrdx-operational',
    icon: '⬡',
    title: 'Operational',
    subtitle: 'Internal runtime operations',
    description:
      'Deployment coordination, rollout control, rollback hooks, scheduling, room provisioning, and policy enforcement flow through this room. It may talk to ASUS and governance, never around evidence.',
    namespace: 'vyrdx-operational',
    deploy: 'DigitalOcean droplet / private lane',
    ingress: 'No public ingress',
    plugin: 'Grab + operate',
    x: 445,
    y: -140,
    z: -80,
    layers: [
      { name: 'control', desc: 'Operator control surface and deploy controls', color: '#93ff8d' },
      { name: 'api', desc: 'Operational APIs', color: '#5fe36b' },
      { name: 'workers', desc: 'Deploy and scheduler worker lanes', color: '#45c75a' },
      { name: 'orchestration', desc: 'Rollout and rollback choreography', color: '#31a84d' },
      { name: 'events', desc: 'Operational event propagation', color: '#86f07b' },
      { name: 'data', desc: 'Runtime state and scheduler data', color: '#49b66f' },
      { name: 'evidence', desc: 'Deployment evidence emission', color: '#78d69c' },
      { name: 'policy', desc: 'Operational policy enforcement', color: '#7cd076' },
      { name: 'ops', desc: 'Room provisioning and runtime care', color: '#9ef0a2' },
    ],
    services: ['operational-api', 'deploy-worker', 'scheduler-worker', 'room-controller'],
    responsibilities: [
      'deploy coordination',
      'rollout control',
      'rollback hooks',
      'runtime scheduling',
      'room provisioning',
      'policy enforcement',
    ],
    rules: [
      'no public ingress',
      'may talk to ASUS and governance',
      'may emit deployment evidence',
      'must not bypass rollout or evidence rules',
    ],
  },
  {
    id: 'vyrdx-campaign',
    icon: '◎',
    title: 'Campaign',
    subtitle: 'Internal campaign and growth workflows',
    description:
      'Audience building, dispatch, internal campaign APIs, and evidence-aware growth operations live here. AI may be used only through approved internal paths.',
    namespace: 'vyrdx-campaign',
    deploy: 'DigitalOcean droplet / private lane',
    ingress: 'Internal only by default',
    plugin: 'Grab + route',
    x: -360,
    y: 175,
    z: -40,
    layers: [
      { name: 'api', desc: 'Internal campaign APIs', color: '#ffbf4b' },
      { name: 'workers', desc: 'Campaign worker fleet', color: '#ff9d2f' },
      { name: 'orchestration', desc: 'Audience and dispatch orchestration', color: '#ff7d2a' },
      { name: 'events', desc: 'Campaign event stream', color: '#ffae57' },
      { name: 'data', desc: 'Audience and response data', color: '#ffd26e' },
      { name: 'evidence', desc: 'Growth execution evidence', color: '#ff8e3b' },
      { name: 'policy', desc: 'Internal path and secret boundaries', color: '#ffb85d' },
      { name: 'ops', desc: 'Campaign operations', color: '#ffe18b' },
    ],
    services: ['campaign-api', 'campaign-worker', 'audience-builder', 'dispatch-worker'],
    responsibilities: [
      'campaign API execution',
      'audience building',
      'dispatch workflows',
      'evidence-aware growth operations',
    ],
    rules: [
      'no public ingress by default',
      'internal only',
      'may use AI only through approved internal path',
      'no broad access to commercial secrets',
    ],
  },
  {
    id: 'vyrdx-ai',
    icon: '◉',
    title: 'AI Hidden',
    subtitle: 'Internal-only AI execution and orchestration',
    description:
      'Inference, embeddings, orchestration, tool-guard, and auditable AI actions live here. It is hidden, least-privileged, and never exposed directly to the internet.',
    namespace: 'vyrdx-ai',
    deploy: 'DigitalOcean droplet / hidden internal lane',
    ingress: 'No public ingress ever',
    plugin: 'Grab + audit',
    x: 385,
    y: 190,
    z: 95,
    layers: [
      { name: 'gateway', desc: 'Internal AI task routing', color: '#c28eff' },
      { name: 'orchestration', desc: 'Agent and workflow coordination', color: '#a56dff' },
      { name: 'inference', desc: 'Model execution lane', color: '#8b4fff' },
      { name: 'embeddings', desc: 'Vector and semantic retrieval', color: '#b698ff' },
      { name: 'tool-guard', desc: 'Least-privilege tool boundary', color: '#7a53ff' },
      { name: 'events', desc: 'AI event bus', color: '#d1b4ff' },
      { name: 'data', desc: 'Internal memory and state', color: '#9b76ff' },
      { name: 'evidence', desc: 'Auditable AI evidence trail', color: '#bd97ff' },
      { name: 'policy', desc: 'AI runtime law and restrictions', color: '#8b68ff' },
      { name: 'ops', desc: 'Private AI operations', color: '#e0c9ff' },
    ],
    services: ['ai-orchestrator', 'ai-worker', 'inference-gateway', 'tool-guard'],
    responsibilities: [
      'internal inference execution',
      'embedding and retrieval',
      'tool-guarded AI actions',
      'auditable AI orchestration',
    ],
    rules: [
      'no public ingress ever',
      'no internet-exposed tool endpoints',
      'explicit egress only',
      'strict least privilege',
      'all tool use auditable',
    ],
  },
  {
    id: 'vyrdx-shared',
    icon: '⟁',
    title: 'Shared Core',
    subtitle: 'Shared infrastructure and mesh boundary',
    description:
      'NATS, Postgres, Redis, object storage, vault, observability, DNS, and the mesh boundary live here. It is internal, selector-based, and intentionally unmeshed for now.',
    namespace: 'vyrdx-shared',
    deploy: 'DigitalOcean droplet / internal shared plane',
    ingress: 'No public ingress',
    plugin: 'Grab + trace',
    x: -90,
    y: 292,
    z: 35,
    layers: [
      { name: 'nats', desc: 'Event bus and room fan-out', color: '#37dcff' },
      { name: 'postgres', desc: 'Primary relational state', color: '#2ebaff' },
      { name: 'redis', desc: 'Low-latency cache and queue support', color: '#17a5ff' },
      { name: 'object-storage', desc: 'Blob and artifact storage', color: '#79ecff' },
      { name: 'vault', desc: 'Secret custody', color: '#9ff7ff' },
      { name: 'observability', desc: 'Metrics, logs, traces', color: '#57cbff' },
      { name: 'dns', desc: 'Service naming and routing metadata', color: '#6beeff' },
      { name: 'mesh-boundary', desc: 'Opaque ports and selector access', color: '#1596ff' },
    ],
    services: ['nats', 'postgres', 'redis', 'vault', 'observability'],
    responsibilities: [
      'shared storage and streaming',
      'secret custody',
      'observability',
      'selector-based room access',
    ],
    rules: [
      'intentionally unmeshed for now',
      'no public ingress',
      'selector-based access only',
      'opaque ports documented and preserved',
    ],
  },
  {
    id: 'vyrdx-governance',
    icon: '⬢',
    title: 'Governance',
    subtitle: 'Authority, signing, policy, and compliance',
    description:
      'Policy routing, certificates, compliance, authority coordination, and risk governance live here. It is private, auditable, and seal-aware.',
    namespace: 'vyrdx-governance',
    deploy: 'DigitalOcean droplet + ASUS authority lane',
    ingress: 'Private authority ingress only',
    plugin: 'Grab + certify',
    x: 225,
    y: 300,
    z: -85,
    layers: [
      { name: 'authority', desc: 'Authority-facing signing and control', color: '#ffd977' },
      { name: 'policy-router', desc: 'Cross-room governance decisions', color: '#ffbf48' },
      { name: 'certificates', desc: 'Certificate issuance and verification', color: '#fff0a8' },
      { name: 'compliance', desc: 'Compliance and legal holds', color: '#ffcb59' },
      { name: 'audit', desc: 'Governance audit trail', color: '#e0a72e' },
      { name: 'risk', desc: 'Risk register and control guardrails', color: '#ffc947' },
    ],
    services: [
      'authority-api',
      'policy-router',
      'certificate-authority',
      'compliance-monitor',
      'audit-governor',
    ],
    responsibilities: [
      'policy routing',
      'certificate handling',
      'compliance controls',
      'authority coordination',
      'risk governance',
    ],
    rules: [
      'no broad public ingress',
      'authority paths explicit only',
      'signing boundaries isolated',
      'cross-room governance must stay auditable',
    ],
  },
];

const CENTRAL_BRAIN: CoreDefinition = {
  id: 'szh-central-brain',
  icon: '✦',
  title: 'SZH Central Brain',
  subtitle: 'Cross-room coordination and live control',
  description:
    'The central brain sits in the middle of the runtime, coordinating room policy, live control, runtime monitoring, evidence-linked state, and orchestration logic across the full VYRDx system.',
  namespace: 'szh-central-brain',
  deploy: 'Cloud runtime control plane',
  ingress: 'Internal control plane only',
  plugin: 'Core anchor',
  layers: [
    { name: 'runtime-status', desc: 'Live runtime snapshot state', color: '#ff8b57' },
    { name: 'execution-monitoring', desc: 'Process, port, and dispatch monitoring', color: '#ffb066' },
    { name: 'live-control-surface', desc: 'Operator-facing live controls', color: '#ffd38a' },
    { name: 'operator-actions', desc: 'Approved command boundary', color: '#ffc36c' },
    { name: 'evidence-linked-room-state', desc: 'Auditable room-state linkage', color: '#ffd79d' },
    { name: 'cross-room-coordination', desc: 'Contracts across all runtime rooms', color: '#6ce2ff' },
    { name: 'policy-routing', desc: 'Central routing of governance policy', color: '#83d0ff' },
    { name: 'decision-support', desc: 'Operator decision support and synthesis', color: '#77f3d1' },
    { name: 'orchestration-logic', desc: 'Central sequencing and dispatch logic', color: '#8cffb1' },
  ],
  services: ['policy-router', 'cross-room-coordinator', 'room-controller', 'operator-surface'],
  responsibilities: [
    'cross-room coordination',
    'policy routing',
    'runtime monitoring',
    'operator control',
    'evidence-linked state synthesis',
  ],
  rules: [
    'central brain governs but does not bypass room policy',
    'every room interaction remains evidence-aware',
    'operator controls stay bounded and auditable',
  ],
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function renderLayerBars(layers: readonly DetailLayer[]): string {
  return layers
    .slice(0, 5)
    .map((layer, index) => {
      const width = 56 + ((index * 11) % 32);
      return (
        '<div class="f-bar" style="width:' +
        String(width) +
        '%;background:' +
        escapeHtml(layer.color) +
        '"></div>'
      );
    })
    .join('');
}

function renderBackStatus(room: RoomDefinition): string {
  return [
    room.namespace.toUpperCase(),
    'DEPLOY // ' + room.deploy.toUpperCase(),
    'INGRESS // ' + room.ingress.toUpperCase(),
    'SERVICES // ' + String(room.services.length),
    'RULES // ' + String(room.rules.length),
  ]
    .map((line) => '<div>' + escapeHtml(line) + '</div>')
    .join('');
}

function renderFrontInjected(room: RoomDefinition): string {
  return room.services
    .slice(0, 3)
    .map((service, index) => {
      const layer = room.layers[index];
      return (
        '<div class="f-stack-row">' +
        '<span class="f-stack-dot" style="background:' +
        escapeHtml(layer?.color ?? '#ffffff') +
        ';box-shadow:0 0 8px ' +
        escapeHtml(layer?.color ?? '#ffffff') +
        '"></span>' +
        '<span class="f-stack-value">' +
        escapeHtml(service) +
        '</span>' +
        '</div>'
      );
    })
    .join('');
}

function renderBackLayers(room: RoomDefinition): string {
  return room.layers
    .slice(0, 5)
    .map((layer) => {
      return (
        '<div class="back-layer-row">' +
        '<span class="back-layer-dot" style="background:' +
        escapeHtml(layer.color) +
        ';box-shadow:0 0 8px ' +
        escapeHtml(layer.color) +
        '"></span>' +
        '<span class="back-layer-name">' +
        escapeHtml(layer.name) +
        '</span>' +
        '<span class="back-layer-state">ACTIVE</span>' +
        '</div>'
      );
    })
    .join('');
}

function renderCube(room: RoomDefinition): string {
  return (
    '<div class="cube-wrap" data-room-id="' +
    escapeHtml(room.id) +
    '" style="--room-x:' +
    String(room.x) +
    'px; --room-y:' +
    String(room.y) +
    'px; --room-z:' +
    String(room.z) +
    '">' +
    '<div class="cube-float">' +
    '<div class="cube">' +
    '<div class="face face-front">' +
    '<div class="f-icon">' +
    escapeHtml(room.icon) +
    '</div>' +
    '<div class="f-title">' +
    escapeHtml(room.title) +
    '</div>' +
    '<div class="f-sub">' +
    escapeHtml(room.subtitle) +
    '</div>' +
    '<div class="f-meta">' +
    '<span class="f-chip">' +
    escapeHtml(room.namespace) +
    '</span>' +
    '<span class="f-chip">' +
    escapeHtml(room.plugin) +
    '</span>' +
    '</div>' +
    '<div class="f-desc">' +
    escapeHtml(room.description) +
    '</div>' +
    '<div class="f-stack-label">Injected inside</div>' +
    '<div class="f-stack">' +
    renderFrontInjected(room) +
    '</div>' +
    '<div class="f-layers">' +
    renderLayerBars(room.layers) +
    '</div>' +
    '<div class="f-seal"><span class="f-dot"></span>VYRDX SEALED</div>' +
    '</div>' +
    '<div class="face face-back">' +
    '<div class="back-title">' +
    escapeHtml(room.title.toUpperCase()) +
    ' // STATUS</div>' +
    '<div class="back-lines">' +
    renderBackStatus(room) +
    '</div>' +
    '<div class="back-layer-title">LAYER READOUT</div>' +
    '<div class="back-layer-list">' +
    renderBackLayers(room) +
    '</div>' +
    '</div>' +
    '<div class="face face-left"></div>' +
    '<div class="face face-right"></div>' +
    '<div class="face face-top"></div>' +
    '<div class="face face-bottom"></div>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

export function renderScene(
  stats: GatewayStats,
  meta: SceneMeta = {
    pageTitle: 'VYRDON',
    routeLabel: 'vyrdx.vyrdon.com / platform landing',
    hint: 'open it. grab a box. drag it. watch it spin.',
  }
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(meta.pageTitle)}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Flip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Draggable.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}

html{
  --ember:#ff4400;
  --seal:#ff6600;
  --ice:#00ccff;
  --line:rgba(255,68,0,0.04);
}

body{
  width:100%;
  height:100vh;
  overflow:hidden;
  background:#000;
  color:#fff;
  font-family:'Rajdhani',sans-serif;
  cursor:crosshair;
}

#space{position:fixed;inset:0;z-index:0;overflow:hidden}
.star{position:absolute;border-radius:50%;background:#fff}

#space::before{
  content:'';
  position:absolute;
  inset:0;
  background:
    radial-gradient(circle at 50% 42%,rgba(0,204,255,0.07) 0%,transparent 24%),
    radial-gradient(circle at 48% 62%,rgba(255,68,0,0.08) 0%,transparent 26%);
  pointer-events:none;
}

#space::after{
  content:'';
  position:absolute;
  inset:0;
  background:radial-gradient(circle at center,transparent 36%,rgba(0,0,0,0.42) 100%);
  pointer-events:none;
}

#nebula{
  position:fixed;
  inset:0;
  z-index:1;
  pointer-events:none;
  background:
    radial-gradient(ellipse at 15% 45%,rgba(255,68,0,0.05) 0%,transparent 55%),
    radial-gradient(ellipse at 85% 25%,rgba(0,204,255,0.04) 0%,transparent 50%),
    radial-gradient(ellipse at 50% 85%,rgba(255,102,0,0.03) 0%,transparent 45%);
}

.dust{
  position:fixed;
  border-radius:50%;
  background:var(--ember);
  opacity:0;
  pointer-events:none;
  z-index:2;
}

#grid-floor{
  position:fixed;
  bottom:-6vh;
  left:50%;
  width:220vw;
  height:66vh;
  transform:translateX(-50%) perspective(640px) rotateX(68deg);
  transform-origin:center bottom;
  background-image:
    repeating-linear-gradient(90deg,var(--line) 0px,var(--line) 1px,transparent 1px,transparent 84px),
    repeating-linear-gradient(0deg,var(--line) 0px,var(--line) 1px,transparent 1px,transparent 84px);
  z-index:3;
  pointer-events:none;
  animation:gridScroll 20s linear infinite;
}

@keyframes gridScroll{
  0%{background-position:0 0}
  100%{background-position:0 84px}
}

#gate-l,#gate-r{
  position:fixed;
  top:0;
  width:50%;
  height:100%;
  z-index:100;
  display:flex;
  align-items:center;
  overflow:hidden;
}

#gate-l{
  left:0;
  background:linear-gradient(135deg,#000,#060606);
  border-right:1px solid rgba(255,68,0,0.06);
}

#gate-r{
  right:0;
  background:linear-gradient(225deg,#000,#060606);
  border-left:1px solid rgba(255,68,0,0.06);
}

.gate-line{
  position:absolute;
  top:0;
  width:2px;
  height:100%;
  background:linear-gradient(180deg,transparent,var(--ember),var(--seal),var(--ice),transparent);
  opacity:0.25;
}

#gate-l .gate-line{right:0}
#gate-r .gate-line{left:0}

#logo{
  position:fixed;
  top:50%;
  left:50%;
  transform:translate(-50%,-50%);
  z-index:200;
  cursor:pointer;
  text-align:center;
  user-select:none;
}

#logo h1{
  font-family:'Orbitron',sans-serif;
  font-size:clamp(2.5rem,6vw,5rem);
  font-weight:900;
  letter-spacing:0.3em;
  color:transparent;
  background:linear-gradient(135deg,var(--ember),var(--seal),var(--ice));
  -webkit-background-clip:text;
  background-clip:text;
  filter:drop-shadow(0 0 50px rgba(255,68,0,0.35));
}

#logo p{
  font-size:0.75rem;
  letter-spacing:0.8em;
  color:rgba(255,255,255,0.15);
  margin-top:0.8rem;
  text-transform:uppercase;
}

#logo .route{
  font-size:0.62rem;
  letter-spacing:0.42em;
  color:rgba(0,204,255,0.24);
  margin-top:1rem;
  text-transform:uppercase;
}

#logo .hint{
  font-size:0.6rem;
  letter-spacing:0.4em;
  color:rgba(255,255,255,0.1);
  margin-top:2rem;
  animation:p 2s ease-in-out infinite;
}

@keyframes p{
  0%,100%{opacity:0.1}
  50%{opacity:0.3}
}

#ring{
  width:138px;
  height:138px;
  border:1px solid rgba(255,68,0,0.1);
  border-radius:50%;
  position:absolute;
  top:50%;
  left:50%;
  transform:translate(-50%,-50%);
  pointer-events:none;
}

#hud{
  position:fixed;
  top:18px;
  left:50%;
  transform:translateX(-50%);
  z-index:70;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  justify-content:center;
  visibility:hidden;
}

.hud-pill{
  padding:8px 12px;
  border:1px solid rgba(255,255,255,0.08);
  border-radius:999px;
  background:rgba(8,8,8,0.75);
  backdrop-filter:blur(18px);
  font-size:0.58rem;
  letter-spacing:0.22em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.35);
}

.hud-pill strong{
  color:#fff;
  margin-left:6px;
}

#scene{
  position:fixed;
  inset:0;
  z-index:50;
  perspective:1000px;
  perspective-origin:50% 45%;
  visibility:hidden;
}

#world{
  width:100%;
  height:100%;
  position:relative;
  transform-style:preserve-3d;
}

#core-node{
  position:absolute;
  left:50%;
  top:50%;
  width:260px;
  height:260px;
  transform:translate(-50%,-50%);
  transform-style:preserve-3d;
  z-index:60;
  cursor:pointer;
}

#core-node::before{
  content:'';
  position:absolute;
  inset:-34px;
  border:1px solid rgba(255,255,255,0.05);
  border-radius:50%;
  box-shadow:0 0 40px rgba(255,68,0,0.08);
}

#core-shell{
  width:100%;
  height:100%;
  border-radius:50%;
  border:1px solid rgba(255,255,255,0.08);
  background:
    radial-gradient(circle at 50% 50%,rgba(255,68,0,0.18) 0%,rgba(0,0,0,0.88) 62%),
    linear-gradient(135deg,rgba(255,68,0,0.08),rgba(0,204,255,0.08));
  backdrop-filter:blur(20px);
  box-shadow:0 0 80px rgba(255,68,0,0.16);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  padding:26px;
}

#core-shell:hover{
  border-color:rgba(255,68,0,0.28);
  box-shadow:0 0 100px rgba(255,68,0,0.24);
}

#core-mark{
  font-family:'Orbitron',sans-serif;
  font-size:2.2rem;
  font-weight:900;
  letter-spacing:0.2em;
  color:transparent;
  background:linear-gradient(135deg,var(--ember),var(--seal),var(--ice));
  -webkit-background-clip:text;
  background-clip:text;
}

#core-title{
  margin-top:14px;
  font-size:0.72rem;
  letter-spacing:0.34em;
  color:rgba(255,255,255,0.38);
  text-transform:uppercase;
}

#core-copy{
  margin-top:16px;
  font-size:0.7rem;
  line-height:1.65;
  color:rgba(255,255,255,0.28);
}

.cube-wrap{
  position:absolute;
  cursor:grab;
  user-select:none;
  transform-style:preserve-3d;
  width:200px;
  height:250px;
}

.cube-wrap:active{cursor:grabbing}

.cube-wrap::after{
  content:'';
  position:absolute;
  bottom:-40px;
  left:10%;
  width:80%;
  height:20px;
  background:radial-gradient(ellipse,rgba(255,68,0,0.14),transparent);
  filter:blur(12px);
  pointer-events:none;
  opacity:0;
  transition:opacity 0.4s;
}

.cube-wrap:hover::after{opacity:1}

.cube-float{
  width:100%;
  height:100%;
  transform-style:preserve-3d;
}

.cube{
  width:100%;
  height:100%;
  position:relative;
  transform-style:preserve-3d;
  transition:transform 0.6s cubic-bezier(0.23,1,0.32,1);
}

.cube-wrap:hover .cube{
  transform:rotateY(-8deg) rotateX(4deg);
}

.cube-wrap.is-dragging .cube{
  transition:none;
}

.face{
  position:absolute;
  backface-visibility:visible;
  background:rgba(6,6,6,0.88);
  border:1px solid rgba(255,255,255,0.05);
  overflow:hidden;
}

.face-front{
  width:200px;
  height:250px;
  transform:translateZ(30px);
}

.face-front::before{
  content:'';
  position:absolute;
  inset:0;
  background:
    linear-gradient(180deg,rgba(255,255,255,0.05) 0%,transparent 24%,transparent 100%),
    radial-gradient(circle at 18% 12%,rgba(255,68,0,0.09) 0%,transparent 26%);
  pointer-events:none;
}

.face-back{
  width:200px;
  height:250px;
  transform:rotateY(180deg) translateZ(30px);
  background:rgba(4,4,4,0.96);
}

.face-left{
  width:60px;
  height:250px;
  left:-30px;
  transform:rotateY(-90deg) translateZ(0px);
  background:linear-gradient(180deg,rgba(255,68,0,0.08),rgba(0,0,0,0.92));
}

.face-right{
  width:60px;
  height:250px;
  right:-30px;
  transform:rotateY(90deg) translateZ(200px);
  background:linear-gradient(180deg,rgba(0,204,255,0.06),rgba(0,0,0,0.92));
}

.face-top{
  width:200px;
  height:60px;
  top:-30px;
  transform:rotateX(90deg) translateZ(0px);
  background:linear-gradient(90deg,rgba(255,68,0,0.08),rgba(0,204,255,0.05));
}

.face-bottom{
  width:200px;
  height:60px;
  bottom:-30px;
  transform:rotateX(-90deg) translateZ(250px);
  background:rgba(255,68,0,0.03);
  box-shadow:0 0 70px rgba(255,68,0,0.08);
}

.f-icon{
  padding:20px 18px 0;
  font-size:1.8rem;
  opacity:0.65;
}

.f-title{
  padding:6px 18px 0;
  font-family:'Orbitron',sans-serif;
  font-size:0.55rem;
  font-weight:700;
  letter-spacing:0.3em;
  text-transform:uppercase;
  color:var(--seal);
}

.f-sub{
  padding:8px 18px 0;
  font-size:0.58rem;
  letter-spacing:0.18em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.16);
}

.f-meta{
  padding:10px 18px 0;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}

.f-chip{
  padding:5px 7px 4px;
  border:1px solid rgba(255,255,255,0.08);
  background:rgba(255,255,255,0.02);
  font-size:0.46rem;
  letter-spacing:0.12em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.34);
}

.f-desc{
  padding:10px 18px 8px;
  font-size:0.64rem;
  line-height:1.55;
  color:rgba(255,255,255,0.3);
}

.f-stack-label{
  padding:0 18px;
  font-family:'Orbitron',sans-serif;
  font-size:0.42rem;
  letter-spacing:0.22em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.18);
}

.f-stack{
  padding:8px 18px 10px;
  display:flex;
  flex-direction:column;
  gap:7px;
}

.f-stack-row{
  display:flex;
  align-items:center;
  gap:8px;
  min-height:14px;
}

.f-stack-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  flex-shrink:0;
}

.f-stack-value{
  font-size:0.53rem;
  letter-spacing:0.12em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.4);
  line-height:1.4;
}

.f-layers{
  padding:0 18px;
  display:flex;
  flex-direction:column;
  gap:4px;
  margin-top:auto;
}

.f-bar{
  height:3px;
  border-radius:1px;
  opacity:0.5;
  transition:opacity 0.3s,width 0.4s;
}

.cube-wrap:hover .f-bar{opacity:0.92}

.f-seal{
  position:absolute;
  bottom:0;
  left:0;
  right:0;
  padding:10px 18px;
  border-top:1px solid rgba(255,255,255,0.03);
  font-size:0.5rem;
  letter-spacing:0.2em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.12);
  display:flex;
  align-items:center;
  gap:5px;
}

.f-dot{
  width:4px;
  height:4px;
  border-radius:50%;
  background:var(--ember);
  box-shadow:0 0 6px var(--ember);
}

.back-title{
  padding:18px 18px 0;
  font-family:'Orbitron',sans-serif;
  font-size:0.52rem;
  letter-spacing:0.22em;
  color:rgba(255,255,255,0.22);
  text-transform:uppercase;
}

.back-lines{
  padding:18px 18px 12px;
  display:flex;
  flex-direction:column;
  gap:8px;
  font-size:0.54rem;
  letter-spacing:0.18em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.18);
  line-height:1.6;
}

.back-layer-title{
  padding:0 18px;
  font-family:'Orbitron',sans-serif;
  font-size:0.42rem;
  letter-spacing:0.22em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.18);
}

.back-layer-list{
  padding:10px 18px 16px;
  display:flex;
  flex-direction:column;
  gap:8px;
}

.back-layer-row{
  display:flex;
  align-items:center;
  gap:8px;
  min-height:15px;
}

.back-layer-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  flex-shrink:0;
}

.back-layer-name{
  font-size:0.5rem;
  letter-spacing:0.12em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.42);
}

.back-layer-state{
  margin-left:auto;
  font-size:0.46rem;
  letter-spacing:0.14em;
  text-transform:uppercase;
  color:var(--ember);
}

#detail-backdrop{
  position:fixed;
  inset:0;
  z-index:295;
  background:rgba(0,0,0,0.68);
  backdrop-filter:blur(8px);
  visibility:hidden;
}

#detail{
  position:fixed;
  top:50%;
  left:50%;
  transform:translate(-50%,-50%);
  width:72vw;
  max-width:880px;
  max-height:86vh;
  background:rgba(8,8,8,0.97);
  backdrop-filter:blur(40px);
  border:1px solid rgba(255,68,0,0.16);
  border-radius:4px;
  z-index:300;
  visibility:hidden;
  overflow:hidden;
  display:flex;
  flex-direction:column;
}

#detail-header{
  padding:30px 36px 22px;
  border-bottom:1px solid rgba(255,255,255,0.05);
  display:flex;
  align-items:center;
  gap:20px;
}

#detail-icon{font-size:2.6rem}

#detail-title{
  font-family:'Orbitron',sans-serif;
  font-size:1.08rem;
  font-weight:700;
  letter-spacing:0.2em;
  text-transform:uppercase;
  color:var(--seal);
}

#detail-subtitle{
  font-size:0.8rem;
  color:rgba(255,255,255,0.3);
  margin-top:4px;
}

#detail-close{
  margin-left:auto;
  cursor:pointer;
  font-size:1.2rem;
  color:rgba(255,255,255,0.2);
  padding:8px;
  transition:color 0.3s;
}

#detail-close:hover{color:var(--ember)}

#detail-content{
  padding:0 36px 32px;
  overflow-y:auto;
  flex:1;
}

#detail-desc{
  padding:24px 0 22px;
  font-size:0.88rem;
  line-height:1.82;
  color:rgba(255,255,255,0.42);
  border-bottom:1px solid rgba(255,255,255,0.05);
}

#detail-meta{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:12px;
  padding:20px 0 8px;
}

.detail-meta-card{
  border:1px solid rgba(255,255,255,0.06);
  background:rgba(255,255,255,0.02);
  padding:14px 14px 12px;
}

.detail-meta-label{
  font-size:0.52rem;
  letter-spacing:0.22em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.22);
  margin-bottom:8px;
}

.detail-meta-value{
  font-size:0.78rem;
  line-height:1.45;
  color:rgba(255,255,255,0.58);
}

.detail-block{
  padding:20px 0 0;
}

.detail-block-title{
  font-family:'Orbitron',sans-serif;
  font-size:0.56rem;
  font-weight:700;
  letter-spacing:0.3em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.22);
  margin-bottom:16px;
}

.detail-layer{
  display:flex;
  align-items:center;
  gap:14px;
  padding:12px 0;
  border-bottom:1px solid rgba(255,255,255,0.03);
}

.detail-layer-dot{
  width:8px;
  height:8px;
  border-radius:50%;
  flex-shrink:0;
}

.detail-layer-name{
  font-family:'Orbitron',sans-serif;
  font-size:0.6rem;
  font-weight:600;
  letter-spacing:0.14em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.5);
  width:152px;
  flex-shrink:0;
}

.detail-layer-desc{
  font-size:0.74rem;
  color:rgba(255,255,255,0.25);
  line-height:1.42;
}

.detail-layer-status{
  margin-left:auto;
  font-size:0.5rem;
  letter-spacing:0.15em;
  text-transform:uppercase;
  color:var(--ember);
  flex-shrink:0;
}

.detail-chip-list{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.detail-chip{
  padding:9px 12px 8px;
  border:1px solid rgba(255,255,255,0.08);
  background:rgba(255,255,255,0.03);
  font-size:0.68rem;
  letter-spacing:0.12em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.52);
}

.detail-rule-list{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.detail-rule{
  padding:12px 14px;
  border-left:2px solid rgba(255,68,0,0.42);
  background:rgba(255,255,255,0.02);
  font-size:0.78rem;
  line-height:1.6;
  color:rgba(255,255,255,0.42);
}

#scan{
  position:fixed;
  inset:0;
  z-index:400;
  pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.015) 2px,rgba(0,0,0,0.015) 4px);
}

@media (max-width: 980px){
  body{
    height:auto;
    min-height:100vh;
    overflow-x:hidden;
    overflow-y:auto;
  }

  #grid-floor{
    display:none;
  }

  #logo{
    width:calc(100vw - 24px);
  }

  #logo h1{
    font-size:clamp(2rem,13vw,3rem);
    letter-spacing:0.18em;
  }

  #logo p, #logo .route, #logo .hint{
    letter-spacing:0.22em;
  }

  #scene{
    overflow-y:auto;
  }

  #scene.compact #world{
    display:flex;
    flex-direction:column;
    align-items:center;
    padding:118px 16px 42px;
    min-height:100vh;
  }

  #scene.compact #core-node{
    position:relative;
    left:auto;
    top:auto;
    transform:none;
    width:min(100%,300px);
    height:240px;
    margin-bottom:24px;
  }

  #scene.compact .cube-wrap{
    position:relative;
    margin-bottom:22px;
  }

  #hud{
    top:10px;
    width:calc(100vw - 16px);
  }

  #detail{
    width:calc(100vw - 18px);
    max-height:88vh;
  }

  #detail-header{
    padding:22px 18px 18px;
  }

  #detail-content{
    padding:0 18px 24px;
  }

  #detail-meta{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }

  .detail-layer{
    display:grid;
    grid-template-columns:12px 1fr;
    gap:10px;
  }

  .detail-layer-name,
  .detail-layer-desc,
  .detail-layer-status{
    width:auto;
    margin-left:0;
  }

  .detail-layer-name{grid-column:2}
  .detail-layer-desc{grid-column:2}
  .detail-layer-status{grid-column:2}
}
</style>
</head>
<body>
<div id="space"></div>
<div id="nebula"></div>
<div id="grid-floor"></div>
<div id="scan"></div>

<div id="gate-l"><div class="gate-line"></div></div>
<div id="gate-r"><div class="gate-line"></div></div>

<div id="logo">
  <div id="ring"></div>
  <h1>VYRDON</h1>
  <p>Deterministic execution protocol</p>
  <div class="route">${escapeHtml(meta.routeLabel)}</div>
  <div class="hint">${escapeHtml(meta.hint)}</div>
</div>

<div id="hud">
  <div class="hud-pill">rooms<strong>${ROOM_DEFINITIONS.length}</strong></div>
  <div class="hud-pill">agents<strong>${stats.agentCount}</strong></div>
  <div class="hud-pill">engines<strong>${stats.engineCount}</strong></div>
  <div class="hud-pill">cloud<strong>digitalocean</strong></div>
  <div class="hud-pill">mode<strong>${escapeHtml(stats.inference.mode)}</strong></div>
</div>

<div id="scene">
  <div id="world">
    <div id="core-node" data-room-id="${escapeHtml(CENTRAL_BRAIN.id)}">
      <div id="core-shell">
        <div id="core-mark">VYRDON</div>
        <div id="core-title">SZH Central Brain</div>
        <div id="core-copy">Click the core to open the central control layers that coordinate every room in the runtime.</div>
      </div>
    </div>
    ${ROOM_DEFINITIONS.map(renderCube).join('')}
  </div>
</div>

<div id="detail-backdrop"></div>
<div id="detail">
  <div id="detail-header">
    <div id="detail-icon"></div>
    <div>
      <div id="detail-title"></div>
      <div id="detail-subtitle"></div>
    </div>
    <div id="detail-close">✕</div>
  </div>
  <div id="detail-content">
    <div id="detail-desc"></div>
    <div id="detail-meta">
      <div class="detail-meta-card">
        <div class="detail-meta-label">Namespace</div>
        <div id="detail-namespace" class="detail-meta-value"></div>
      </div>
      <div class="detail-meta-card">
        <div class="detail-meta-label">Deploy</div>
        <div id="detail-deploy" class="detail-meta-value"></div>
      </div>
      <div class="detail-meta-card">
        <div class="detail-meta-label">Ingress</div>
        <div id="detail-ingress" class="detail-meta-value"></div>
      </div>
      <div class="detail-meta-card">
        <div class="detail-meta-label">Plugin</div>
        <div id="detail-plugin" class="detail-meta-value"></div>
      </div>
    </div>
    <div class="detail-block">
      <div class="detail-block-title">Engine Layers</div>
      <div id="detail-layers-list"></div>
    </div>
    <div class="detail-block">
      <div class="detail-block-title">Services</div>
      <div id="detail-services" class="detail-chip-list"></div>
    </div>
    <div class="detail-block">
      <div class="detail-block-title">Responsibilities</div>
      <div id="detail-responsibilities" class="detail-chip-list"></div>
    </div>
    <div class="detail-block">
      <div class="detail-block-title">Rules</div>
      <div id="detail-rules" class="detail-rule-list"></div>
    </div>
  </div>
</div>

<script>
const ROOM_PAYLOAD = ${serializeJson(ROOM_DEFINITIONS)};
const CORE_PAYLOAD = ${serializeJson(CENTRAL_BRAIN)};

gsap.registerPlugin(Flip,Draggable);

let opened=false;
let detailActive=false;
let activeAnchor=null;

const payloadById = {};
ROOM_PAYLOAD.forEach(function(room){ payloadById[room.id]=room; });
payloadById[CORE_PAYLOAD.id]=CORE_PAYLOAD;

(function buildStars(){
  const space=document.getElementById('space');
  for(let i=0;i<300;i+=1){
    const star=document.createElement('div');
    const size=Math.random()*2.5+0.3;
    star.className='star';
    Object.assign(star.style,{
      width:size+'px',
      height:size+'px',
      left:Math.random()*100+'%',
      top:Math.random()*100+'%',
      opacity:String(Math.random()*0.5+0.1)
    });
    space.appendChild(star);
    gsap.to(star,{
      opacity:Math.random()*0.15+0.05,
      duration:Math.random()*5+2,
      repeat:-1,
      yoyo:true,
      ease:'sine.inOut',
      delay:Math.random()*4
    });
  }
  gsap.to(space,{x:-50,y:-30,duration:90,repeat:-1,yoyo:true,ease:'none'});
})();

(function buildDust(){
  for(let i=0;i<10;i+=1){
    const dust=document.createElement('div');
    dust.className='dust';
    Object.assign(dust.style,{
      width:(Math.random()*2+1)+'px',
      height:(Math.random()*2+1)+'px'
    });
    document.body.appendChild(dust);
    const animate=function(){
      gsap.set(dust,{x:Math.random()*innerWidth,y:innerHeight+10,opacity:0});
      gsap.to(dust,{
        y:-10,
        x:'+='+String(Math.random()*150-75),
        opacity:Math.random()*0.1+0.02,
        duration:Math.random()*20+12,
        ease:'none',
        onComplete:animate
      });
    };
    animate();
  }
})();

gsap.to('#ring',{scale:2.8,opacity:0,duration:2.8,repeat:-1,ease:'power1.out'});
gsap.from('#logo h1',{opacity:0,scale:0.85,filter:'blur(14px)',duration:2.2,ease:'power3.out'});
gsap.from('#logo p',{opacity:0,y:12,duration:1,delay:1,ease:'power2.out'});
gsap.from('#logo .route',{opacity:0,y:12,duration:1,delay:1.15,ease:'power2.out'});
gsap.to('html',{'--ember':'#ff6600',duration:3,repeat:-1,yoyo:true,ease:'sine.inOut'});

function isCompact(){
  return window.matchMedia('(max-width: 980px)').matches;
}

function fillChipList(containerId, values){
  const container=document.getElementById(containerId);
  container.innerHTML='';
  values.forEach(function(value){
    const chip=document.createElement('div');
    chip.className='detail-chip';
    chip.textContent=value;
    container.appendChild(chip);
  });
}

function fillRuleList(containerId, values){
  const container=document.getElementById(containerId);
  container.innerHTML='';
  values.forEach(function(value){
    const rule=document.createElement('div');
    rule.className='detail-rule';
    rule.textContent=value;
    container.appendChild(rule);
  });
}

function fillLayerList(layers){
  const list=document.getElementById('detail-layers-list');
  list.innerHTML='';
  layers.forEach(function(layer){
    const row=document.createElement('div');
    row.className='detail-layer';
    row.innerHTML=
      '<div class="detail-layer-dot" style="background:'+layer.color+';box-shadow:0 0 8px '+layer.color+'"></div>'+
      '<div class="detail-layer-name">'+layer.name+'</div>'+
      '<div class="detail-layer-desc">'+layer.desc+'</div>'+
      '<div class="detail-layer-status">ACTIVE</div>';
    list.appendChild(row);
  });
}

function renderDetail(payload){
  document.getElementById('detail-icon').textContent=payload.icon;
  document.getElementById('detail-title').textContent=payload.title;
  document.getElementById('detail-subtitle').textContent=payload.subtitle;
  document.getElementById('detail-desc').textContent=payload.description;
  document.getElementById('detail-namespace').textContent=payload.namespace;
  document.getElementById('detail-deploy').textContent=payload.deploy;
  document.getElementById('detail-ingress').textContent=payload.ingress;
  document.getElementById('detail-plugin').textContent=payload.plugin;
  fillLayerList(payload.layers);
  fillChipList('detail-services', payload.services);
  fillChipList('detail-responsibilities', payload.responsibilities);
  fillRuleList('detail-rules', payload.rules);
}

function showDetail(anchor, payload){
  if(detailActive){
    hideDetail();
  }
  detailActive=true;
  activeAnchor=anchor;
  renderDetail(payload);

  const backdrop=document.getElementById('detail-backdrop');
  backdrop.style.visibility='visible';
  gsap.fromTo(backdrop,{opacity:0},{opacity:1,duration:0.25,ease:'power2.out'});

  const detail=document.getElementById('detail');
  Flip.fit(detail, anchor, {scale:true});
  const state=Flip.getState(detail);
  gsap.set(detail,{clearProps:true});
  gsap.set(detail,{xPercent:-50,yPercent:-50,top:'50%',left:'50%',visibility:'visible',overflow:'hidden'});

  Flip.from(state,{
    duration:0.62,
    ease:'power2.inOut',
    scale:true,
    onComplete:function(){
      gsap.set(detail,{overflow:'auto'});
    }
  });

  gsap.from('#detail-content',{yPercent:18,opacity:0,duration:0.38,delay:0.22,ease:'power2.out'});
  gsap.from('.detail-layer',{opacity:0,x:-20,stagger:0.05,duration:0.32,delay:0.34,ease:'power2.out'});
  gsap.to('.cube-wrap, #core-node',{opacity:0.16,scale:0.94,duration:0.45,ease:'power2.out'});
  gsap.to(anchor,{opacity:1,scale:1.02,duration:0.2,overwrite:true});
}

function hideDetail(){
  if(!detailActive || !activeAnchor){
    return;
  }
  detailActive=false;
  const anchor=activeAnchor;
  activeAnchor=null;

  const detail=document.getElementById('detail');
  gsap.set(detail,{overflow:'hidden'});
  const state=Flip.getState(detail);
  Flip.fit(detail, anchor, {scale:true});

  gsap.to('#detail-backdrop',{
    opacity:0,
    duration:0.2,
    ease:'power2.out',
    onComplete:function(){
      document.getElementById('detail-backdrop').style.visibility='hidden';
    }
  });
  gsap.to('#detail-content',{yPercent:12,opacity:0,duration:0.2,ease:'power2.in'});

  Flip.from(state,{
    scale:true,
    duration:0.5,
    delay:0.1,
    ease:'power2.inOut',
    onComplete:function(){
      gsap.set(detail,{visibility:'hidden'});
    }
  });

  gsap.to('.cube-wrap, #core-node',{opacity:1,scale:1,duration:0.45,ease:'power2.out'});
}

function bindDetailOpeners(){
  document.querySelectorAll('.cube-wrap').forEach(function(wrap){
    wrap.addEventListener('click', function(){
      const draggable=Draggable.get(wrap);
      if(draggable && draggable.isDragging){
        return;
      }
      const payload=payloadById[wrap.getAttribute('data-room-id')];
      if(payload){
        showDetail(wrap, payload);
      }
    });
  });

  document.getElementById('core-node').addEventListener('click', function(){
    showDetail(document.getElementById('core-node'), CORE_PAYLOAD);
  });

  document.getElementById('detail-close').addEventListener('click', hideDetail);
  document.getElementById('detail-backdrop').addEventListener('click', hideDetail);
}

function enableParallax(){
  document.addEventListener('mousemove', function(event){
    if(detailActive || isCompact()){
      return;
    }
    const mx=(event.clientX/innerWidth-0.5)*2;
    const my=(event.clientY/innerHeight-0.5)*2;
    gsap.to('#world',{rotateY:mx*5,rotateX:my*-3,duration:1.4,ease:'power2.out'});
  });
}

function enableDragging(){
  if(isCompact()){
    return;
  }
  Draggable.create('.cube-wrap',{
    type:'x,y',
    bounds:'#scene',
    onPress:function(){
      this.target.classList.add('is-dragging');
      gsap.to(this.target,{scale:1.08,zIndex:200,duration:0.25});
      gsap.to(this.target.querySelector('.cube'),{rotateY:'-=15',duration:0.22,overwrite:true});
    },
    onDrag:function(){
      const cube=this.target.querySelector('.cube');
      gsap.to(cube,{
        rotateY:'+='+String(this.deltaX*0.6),
        rotateX:'+='+String(this.deltaY*-0.35),
        duration:0.18,
        overwrite:true
      });
    },
    onRelease:function(){
      this.target.classList.remove('is-dragging');
      gsap.to(this.target,{scale:1,duration:0.4,ease:'power2.out'});
      gsap.to(this.target.querySelector('.cube'),{
        rotateY:0,
        rotateX:0,
        duration:1,
        ease:'elastic.out(1,0.5)'
      });
    }
  });
}

function placeScene(){
  const scene=document.getElementById('scene');
  const centerX=innerWidth/2;
  const centerY=innerHeight/2;
  scene.classList.toggle('compact', isCompact());

  if(isCompact()){
    gsap.from('#core-node',{opacity:0,y:24,duration:0.7,ease:'power2.out'});
    gsap.from('.cube-wrap',{opacity:0,y:32,duration:0.75,stagger:0.08,ease:'power2.out'});
    return;
  }

  gsap.from('#core-node',{opacity:0,scale:0.3,duration:0.9,ease:'power3.out'});
  gsap.to('#core-shell',{rotate:360,duration:52,repeat:-1,ease:'none'});
  gsap.to('#core-mark',{textShadow:'0 0 30px rgba(255,68,0,0.32)',duration:1.9,repeat:-1,yoyo:true,ease:'sine.inOut'});
  gsap.to('#core-node',{y:'+=10',duration:4.6,repeat:-1,yoyo:true,ease:'sine.inOut'});

  document.querySelectorAll('.cube-wrap').forEach(function(wrap, index){
    const roomX=parseInt(getComputedStyle(wrap).getPropertyValue('--room-x'), 10) || 0;
    const roomY=parseInt(getComputedStyle(wrap).getPropertyValue('--room-y'), 10) || 0;
    const roomZ=parseInt(getComputedStyle(wrap).getPropertyValue('--room-z'), 10) || 0;
    const targetX=centerX+roomX-100;
    const targetY=centerY+roomY-125;

    gsap.set(wrap,{
      x:centerX-100,
      y:centerY-125,
      opacity:0,
      scale:0.15,
      rotateY:roomZ*2,
      rotateX:-18
    });

    gsap.to(wrap,{
      x:targetX,
      y:targetY,
      opacity:1,
      scale:1,
      rotateY:roomZ*0.22,
      rotateX:roomZ*-0.06,
      duration:1.35,
      delay:index*0.08,
      ease:'power3.out'
    });

    gsap.to(wrap.querySelector('.cube-float'),{
      y:'+='+String(Math.random()*18-9),
      x:'+='+String(Math.random()*10-5),
      rotateY:'+='+String(4+Math.random()*4),
      rotateX:'+='+String(Math.random()*3-1.5),
      duration:Math.random()*6+4,
      repeat:-1,
      yoyo:true,
      ease:'sine.inOut',
      delay:1.4+index*0.08
    });
  });
}

function openGate(){
  if(opened){
    return;
  }
  opened=true;
  gsap.timeline()
    .to('#logo h1',{textShadow:'0 0 120px rgba(255,68,0,0.9)',duration:0.25})
    .to('#logo',{scale:1.8,opacity:0,duration:0.6,ease:'power3.in'},'+=0.05')
    .to('#gate-l',{x:'-105%',duration:1.5,ease:'power3.inOut'},'-=0.15')
    .to('#gate-r',{x:'105%',duration:1.5,ease:'power3.inOut'},'<')
    .set('#scene',{visibility:'visible'},'-=1')
    .set('#hud',{visibility:'visible'},'-=0.9')
    .call(placeScene,[],'<+=0.2')
    .call(enableDragging,[],'<+=0.4')
    .call(enableParallax,[],'<+=0.1')
    .to('html',{'--ember':'#00ccff','--seal':'#5fe4ff','--line':'rgba(0,204,255,0.05)',duration:5,repeat:-1,yoyo:true,ease:'sine.inOut'},'<+=0.2');
}

document.getElementById('logo').addEventListener('click', openGate);
bindDetailOpeners();

document.addEventListener('keydown', function(event){
  if(event.key===' ' || event.key==='Enter'){
    event.preventDefault();
    openGate();
  }
  if(event.key==='Escape'){
    hideDetail();
  }
});

window.addEventListener('resize', function(){
  if(!opened || detailActive){
    return;
  }
  if(isCompact()){
    return;
  }
  document.querySelectorAll('.cube-wrap').forEach(function(wrap){
    const dragger=Draggable.get(wrap);
    if(dragger){
      dragger.update(true);
    }
  });
});
</script>
</body>
</html>`;
}

export async function registerUIRoutes(app: FastifyInstance): Promise<void> {
  const renderApp = async (request: FastifyRequest, reply: FastifyReply) => {
    // Verify authentication
    const sessionId = request.cookies['vyrden_session'];
    if (!sessionId || !authenticator.isAuthenticated(sessionId)) {
      return reply.status(401).redirect('/');
    }

    const stats = await getGateway().getStats();
    reply.type('text/html');
    return renderScene(stats, {
      pageTitle: 'VYRDON App',
      routeLabel: 'vyrdx.vyrdon.com/app / authenticated platform ui',
      hint: 'commercial, proof, and room visibility under session gate.',
    });
  };

  app.get('/app', renderApp);
  app.get('/app/*', renderApp);
}
