# VYRDx Room Contract Acceptance Matrix
Date: 2026-04-21
Audit basis: current repo state + executed verification commands

| Requirement | Enforcement Location | Test File | Runtime Verification Command | Result | Evidence Ref |
| --- | --- | --- | --- | --- | --- |
| Synthetic mode must never emit green | `server/api/room-contract.ts` (`downgradeSynthesizedSummary`) | `tests/room-contract-api.test.ts` | `curl -sS http://127.0.0.1:7800/api/room-contract/rooms/commercial` | PASS | `docs/contracts/evidence/2026-04-21-room-contract-audit.log.md` |
| Synthetic commercial must never emit eligible certificate state | `server/api/room-contract.ts` (`certificate_eligible=false`, `certificate_issue_ready=false`) | `tests/room-contract-api.test.ts` | `curl -sS http://127.0.0.1:7800/api/room-contract/rooms/commercial` | PASS | `docs/contracts/evidence/2026-04-21-room-contract-audit.log.md` |
| Stop conditions must split into read/write blocking | `server/api/room-contract.ts` (`buildConditionSplit`, `/stop-conditions`) | `tests/room-contract-api.test.ts` | `curl -sS http://127.0.0.1:7800/api/room-contract/stop-conditions` | PASS | `docs/contracts/evidence/2026-04-21-room-contract-audit.log.md` |
| Non-green summary requires reason/evidence/next action | `packages/room-contracts/src/schemas/room-summary.ts` | covered by API validation path + schema parse | `curl -sS http://127.0.0.1:7800/api/room-contract/rooms/commercial` | PASS | `server/api/room-contract.ts`, `packages/room-contracts/src/schemas/room-summary.ts` |
| Green proof-bound rooms require evidence or explicit exemption | `packages/room-contracts/src/schemas/room-summary.ts` | covered by API validation path + schema parse | `curl -sS http://127.0.0.1:7800/api/room-contract/rooms/{room}` | PASS | `packages/room-contracts/src/schemas/room-summary.ts` |
| Room actions must be deny-by-default and role-gated | `server/api/room-contract.ts` (`action_not_allowed`, `policy_denied`) | `tests/room-contract-api.test.ts` (route behavior) | `POST /api/room-contract/rooms/:room/actions` with invalid role/action | PASS | `server/api/room-contract.ts` |
| Mutating actions require evidence reference | `server/api/room-contract.ts` (`evidence_ref_required`) | route behavior covered in API tests | `POST /api/room-contract/rooms/:room/actions` without `evidenceRef` | PASS | `server/api/room-contract.ts` |
| Certificate issue origin restricted to Commercial | `server/api/seal-service.ts` (`certificate_origin_forbidden`) | `tests/vyrdx-client-session.test.ts` + seal service enforcement | `POST /api/v1/seals` without `x-vyrdx-origin-room: commercial` | PASS | `server/api/seal-service.ts`, `tests/vyrdx-client-session.test.ts` |
| Client request layer injects commercial origin + evidence ref | `packages/vyrdx-app/src/lib/customer-requests.ts` | `tests/vyrdx-client-session.test.ts` | `npx vitest run tests/vyrdx-client-session.test.ts` | PASS | `docs/contracts/evidence/2026-04-21-room-contract-audit.log.md` |
| UI font contract lock (IBM Plex Mono, 14px) | `web/app/globals.css` | `tests/room-ui-contract-snapshot.test.ts` | `npx vitest run tests/room-ui-contract-snapshot.test.ts` | PASS | `docs/contracts/evidence/2026-04-21-room-contract-audit.log.md` |
| UI footer contract lock | `web/app/rooms/RoomContractView.tsx` | `tests/room-ui-contract-snapshot.test.ts` | `npx vitest run tests/room-ui-contract-snapshot.test.ts` | PASS | `docs/contracts/evidence/2026-04-21-room-contract-audit.log.md` |
| UI certificate accent isolation lock | `web/app/globals.css`, `web/app/rooms/RoomContractView.tsx` | `tests/room-ui-contract-snapshot.test.ts` | `npx vitest run tests/room-ui-contract-snapshot.test.ts` | PASS | `docs/contracts/evidence/2026-04-21-room-contract-audit.log.md` |
| UI room block order lock | `web/app/rooms/RoomContractView.tsx` | `tests/room-ui-contract-snapshot.test.ts` | `npx vitest run tests/room-ui-contract-snapshot.test.ts` | PASS | `docs/contracts/evidence/2026-04-21-room-contract-audit.log.md` |
| DB-backed mutating path verified (non-synthesized runtime) | `server/index.ts`, `server/db.ts`, `server/api/room-contract.ts` | none in current targeted suite | set `DATABASE_URL`, run migrations, then action e2e | FAIL | Not yet proven in this audit run |
| Market live-source freshness and >=20 target production proof | `server/api/room-contract.ts` (`fetchMarketTargets`) | none proving live production freshness windows | `GET /api/room-contract/rooms/market` on DB-backed prod runtime | FAIL | Local synthesized/no-DB run only |
| Evidence ledger append-only + tx/block integrity runtime proof | `server/db.ts` (`evidence_ledger`) | no end-to-end immutability test in current suite | DB query + mutation-attempt negative tests on live env | FAIL | Not yet proven in this audit run |
| Boundary isolation (VYRDx cloud vs shared droplet) | infra/runtime controls (outside room-contract code) | no direct automated test in current suite | network policy checks + secrets namespace audit | FAIL | Not yet proven in this audit run |
| Certificate issuance end-to-end (entitlement->signer->record->revoke) | `server/api/seal-service.ts` + payment/entitlement path | partial coverage only | full e2e in DB-backed runtime | FAIL | Not yet proven in this audit run |

## Current Acceptance Statement
- Contract-layer acceptance: **PASS**
- Full production acceptance: **FAIL** until DB-backed, market, evidence, isolation, and full certificate e2e gates are proven.

