# VYRDx Production Gate Checklist
Date: 2026-04-21
Purpose: final cutover gates after room-contract hardening

## Gate Status
| Gate | Verification Command(s) | Current Status | Blocking |
| --- | --- | --- | --- |
| 1. DB connected | `echo $DATABASE_URL` + startup log check | FAIL (no DB in audit run) | Yes |
| 2. Migrations applied | start server with DB and verify `migrateSchema()` completion; sample query to `room_registry` | FAIL (not executed in this run) | Yes |
| 3. Market providers live | `curl /api/room-contract/rooms/market` and assert `source_01_status=connected`, `target_universe_count>=20`, freshness threshold pass | FAIL (only synthesized validation executed) | Yes |
| 4. Evidence ledger healthy | DB query on `evidence_ledger` chain continuity + API read checks | FAIL (not executed in this run) | Yes |
| 5. Certificate issuance e2e pass | entitlement check -> issue -> proof -> revoke path in DB-backed runtime | FAIL (not executed in this run) | Yes |
| 6. Shared droplet isolation verified | network policy audit, secret-root separation audit, mount/namespace checks | FAIL (not executed in this run) | Yes |
| 7. Rollback path tested | canary deploy + rollback within target window, evidence recorded | FAIL (not executed in this run) | Yes |
| 8. Canary parity passed | side-by-side parity report against current runtime | FAIL (not executed in this run) | Yes |

## Commands Pack (Run in Order)
1. DB + runtime bring-up
```bash
export DATABASE_URL='<postgres-connection>'
npm run start
```

2. Contract stop-condition verification
```bash
curl -sS http://127.0.0.1:7800/api/room-contract/stop-conditions
```

3. Commercial and market room verification
```bash
curl -sS http://127.0.0.1:7800/api/room-contract/rooms/commercial
curl -sS http://127.0.0.1:7800/api/room-contract/rooms/market
```

4. Contract/API regression suite
```bash
npm run check
npx vitest run tests/room-contract-api.test.ts tests/room-ui-contract-snapshot.test.ts tests/vyrdx-client-session.test.ts
```

5. Full test suite
```bash
npm test
```

## Release Decision Rule
- Do not cut production release unless all 8 gates are PASS.
- Contract-layer PASS alone is insufficient for production go-live.

