# VYRDx Room System Review

> Date: 2026-04-17
> Mode: review-first, report-only
> Baseline: user-defined VYRDx room system for `commercial`, `evidence-public`, `evidence-private`, `operational`, `campaign`, `ai`, `shared`, `governance`

## Findings

### 1. CRITICAL — AI Hidden Room is implemented as a public web product surface

The AI room is defined as internal-only with no public ingress. The current server code does the opposite:

- `vyrden-airoom/src/server.ts`
  - enables CORS for browser clients
  - registers REST routes and a full SPA UI
  - listens on configured host/port as a normal Fastify server
- `vyrden-airoom/src/routes/ui.ts`
  - serves a full browser UI at `/`
- `vyrden-airoom/src/core/config.ts`
  - defaults to `AIROOM_HOST=0.0.0.0`
  - defaults CORS toward `https://vyrden.com`

Impact:

- breaks the room rule: `no public ingress ever`
- turns the hidden internal lane into a browser-facing app
- makes `vyrden.com` look like the AI room itself instead of a front door/proxy boundary

Exact files to patch:

- `vyrden-airoom/src/server.ts`
- `vyrden-airoom/src/routes/ui.ts`
- `vyrden-airoom/src/core/config.ts`

Hold for implementation:

- remove direct public UI serving from AI room
- bind AI room to private network only
- move any public UX to commercial/front-door surface with an approved internal hop

### 2. CRITICAL — Unauthenticated AI mutation/control routes are exposed

Most AI-room routes are unauthenticated even though the room is internal-only and contains mutable state.

Unauthenticated surfaces include:

- `vyrden-airoom/src/routes/api.ts`
  - `/api/chat`
  - `/api/models`
  - `/api/models/pull`
  - `/api/models/:name`
  - `/api/language/*`
  - `/api/calendar/*`
  - `/api/memory/*`
  - `/api/memory/injection`
  - `/api/memory/templates`
  - `/api/memory/flush`

Only a small subset of task and land operations checks `x-vyrdon-key`.

Impact:

- remote prompt/memory poisoning
- remote calendar/data mutation
- remote model pull/delete against local Ollama
- unauthorized access to internal AI runtime state

Exact files to patch:

- `vyrden-airoom/src/routes/api.ts`

Hold for implementation:

- add a default-deny auth guard for the entire AI room
- split public-safe read surfaces from internal mutation surfaces
- block model management and prompt-memory mutation behind private auth only

### 3. HIGH — Task auth is inconsistent and leaks internal results

Task creation and list endpoints require auth, but task detail does not:

- protected: `vyrden-airoom/src/routes/api.ts` `/api/tasks` `POST` and `GET`
- unprotected: `vyrden-airoom/src/routes/api.ts` `/api/tasks/:id` `GET`

The task object can contain prompt content, result text, errors, and `evidenceRef`.

Impact:

- internal job outputs become retrievable without the room secret
- this weakens any future front-door pattern because task polling bypasses it

Exact files to patch:

- `vyrden-airoom/src/routes/api.ts`

### 4. HIGH — Current droplet deployment model collapses room boundaries into one public artifact

The deployment material still describes KITTY as a single droplet artifact exposed at `:7800` via Cloudflare tunnel:

- `DEPLOY_REVIEW.md`
  - “KITTY is the droplet artifact”
  - `vyrdx.vyrdon.com -> http://localhost:7800`
- `deploy/deploy.sh`
  - deploys the whole repo to `/opt/vxstation`
  - verifies directly against public runtime port `7800`
- `deploy/vxstation.service`
  - runs one process from `/opt/vxstation`
- `docs/CODEMAPS/backend.md`
  - still documents one VXSTATION server as the backend surface

Impact:

- commercial, evidence-private, operational, and AI concerns are not actually separated by service boundary
- evidence-private and operational controls are at risk of drifting into the same public runtime plane
- the stated namespace/room model is not yet reflected in deploy topology

Exact files to patch:

- `DEPLOY_REVIEW.md`
- `deploy/deploy.sh`
- `deploy/vxstation.service`
- `deploy/.env.example`
- `docs/CODEMAPS/backend.md`
- `docs/CODEMAPS/architecture.md`
- `docs/RUNBOOK.md`

Hold for implementation:

- define per-room services and ingress class before changing runtime code
- keep evidence-private and AI hidden rooms off public ingress entirely
- make commercial and evidence-public the only public room surfaces

## Exact Patch Set To Queue

Patch first when quota or another worker is available:

1. `vyrden-airoom/src/routes/api.ts`
   reason: auth boundary is the highest-risk live issue
2. `vyrden-airoom/src/server.ts`
   reason: remove public AI-room serving behavior
3. `vyrden-airoom/src/routes/ui.ts`
   reason: stop exposing hidden room as browser app
4. `vyrden-airoom/src/core/config.ts`
   reason: default host/CORS settings conflict with hidden-room policy
5. `DEPLOY_REVIEW.md`
   reason: deployment source-of-truth no longer matches room architecture
6. `deploy/deploy.sh`
   reason: current deploy still ships a single public artifact
7. `deploy/vxstation.service`
   reason: current service definition preserves the single-process droplet model
8. `deploy/.env.example`
   reason: env contract still assumes one exposed runtime
9. `docs/CODEMAPS/backend.md`
   reason: backend map should describe room/service separation
10. `docs/CODEMAPS/architecture.md`
    reason: architecture doc should reflect room ingress boundaries
11. `docs/RUNBOOK.md`
    reason: operator runbook still assumes one public VXSTATION service

## Verification Performed

- `npm run check` at repo root: passed
- `npm run typecheck` in `vyrden-airoom`: passed

Conclusion:

The current problem is not a TypeScript break. It is an architecture and ingress-control break. The AI hidden room and room-boundary model are not being enforced by the current HTTP surfaces and deploy plan.
