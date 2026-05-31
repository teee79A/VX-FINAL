# STATION EXECUTION PLAN (LOCKED)

Date: 2026-03-28  
Scope: stability, reliability, and low-cost execution while preserving Kitty law.

## 1) Locked Points

1. Keep locked Kitty law. No drift.
2. Upgrade ASUS as authority machine.
3. Current Dell becomes Tuning Lab only.
4. Add one dedicated server for stable 24/7 services.
5. Add one higher hardware node for isolated `vyrdox`.
6. Keep `VYRDX` runtime on DigitalOcean.
7. Keep three public read-only trust rooms:
   - ASUS trust room
   - VYRDX trust room
   - VXSTATION trust room
8. Publish hashed receipts only (no raw customer IDs).
9. Build self-hosted API generation system (no paid lock-in).
10. API must support:
   - publish receipt
   - verify receipt
   - room chain head
   - proof lookup
11. All cross-node actions route through Kitty command bus + bridge.
12. No bypass paths. Evidence required on every action.

## 2) Topology Contract

- `ASUSX` (authority): policy, trust, evidence authority.
- `DELL` (tuning): model/tuning only, no authority write path.
- `DEDICATED SERVER` (operations): always-on bridge/API services.
- `VYRDOX NODE` (hidden): isolated high-risk zone, single-agent gated.
- `DIGITALOCEAN` (`VYRDX`): runtime product boundary.

## 3) Route Contract

Allowed:

- `Kitty -> Bridge -> Tuning Lab`
- `Kitty -> Bridge -> Dedicated Server`
- `Kitty -> Bridge -> VYRDOX (policy-gated)`
- `Kitty -> VYRDX boundary request path`

Denied:

- direct `module -> external executor`
- direct `tuning -> VYRDX authority writes`
- direct `vyrdox -> trust room writes`
- any action without evidence

## 4) Trust Room Contract

Each room exposes read-only receipt APIs.

Required receipt fields:

- `receipt_id`
- `room`
- `timestamp_utc`
- `subject_hash` (HMAC-SHA256)
- `payload_hash` (SHA-256)
- `prev_hash`
- `record_hash`
- `signature` (Ed25519)
- `key_id`
- `status`

Privacy rule:

- no raw customer IDs in public payload
- public proof only, private data remains internal

## 5) API Contract (Self-Hosted)

Base path:

- `/v1`

Endpoints:

- `POST /v1/receipts/publish`
- `POST /v1/receipts/verify`
- `GET /v1/rooms/{room}/head`
- `GET /v1/receipts/{receipt_id}/proof`

System properties:

- OpenAPI-first
- generated SDK clients
- append-only evidence writes
- read-only public registry surfaces

## 6) Phase Plan

### Phase 0: Freeze + Baseline

- keep Kitty lockfiles as authority
- no architecture drift
- command bus remains sole control surface

Exit criteria:

- `KITTY_LOCK.md` and `HANDOFF.md` unchanged except approved updates

### Phase 1: Hardware Role Separation

- promote ASUSX to authority role
- repurpose current Dell to tuning-only
- prepare dedicated server role
- prepare isolated `vyrdox` node role

Exit criteria:

- each node has one clear role
- no dual-role authority+tuning on same host

### Phase 2: Route and Policy Enforcement

- enforce allowed/denied route contract in command/bridge policy
- deny by default for unknown targets

Exit criteria:

- policy tests pass with denied bypass scenarios

### Phase 3: Trust Rooms + Public Proof API

- deploy self-hosted trust API
- publish receipt chain heads
- enable verify/proof endpoints

Exit criteria:

- receipt verification works end-to-end
- no raw identifiers in public output

### Phase 4: API Generation and Clients

- generate clients from OpenAPI
- wire internal services to generated clients
- enforce schema drift checks in CI

Exit criteria:

- client generation reproducible in one command

### Phase 5: Reliability Hardening

- systemd services with restart policy
- health checks and alerting
- backup and restore drills

Exit criteria:

- service recovery from restart confirmed
- evidence continuity confirmed

## 7) Non-Negotiables

- no execution authority inside modules
- no command-bus bypass under any condition
- no evidence, no action
- no hidden fallback routing

## 8) Go/No-Go Checklist

Go only if all are true:

- command bus and evidence pipeline healthy
- route policy deny-by-default active
- trust API endpoints healthy
- public read-only proof views active
- topology roles assigned and documented
