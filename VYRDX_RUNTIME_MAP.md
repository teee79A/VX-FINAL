# VYRDX_RUNTIME_MAP.md — /opt/vyrdx Runtime Module Map

> Live JS runtime. DO NOT REWRITE. Wrap with typed adapters in `vyrdx-bridge/`.

## Runtime Root

`/opt/vyrdx` — JavaScript, ESM for core, CJS for services.

## Entrypoint

`/opt/vyrdx/core/bin/vyrdox.js` (60 lines) — boots DB+Redis, loads 7 modules, runs them sequentially.
`/opt/vyrdx/core/bin/codex.js` (1 line) — re-exports `vyrdox.js`.

---

## core/lib/ — Shared library

### config-paths.js (30 lines)

- **Purpose:** Resolves file paths for config, directives, law, strategy, log fallback.
- **Inputs:** `VYRDOX_CORE_BASE` env (default: `/opt/vyrdx/core`)
- **Outputs:** Exported path constants: `CORE_BASE_PATH`, `VYRDOX_CONFIG_PATH`, `VYRDOX_DIRECTIVE_PATH`, `VYRDOX_LAW_PATH`, `VYRDOX_STRATEGY_PATH`, `LOG_FALLBACK`
- **Side effects:** None (pure path computation)
- **Env deps:** `VYRDOX_CORE_BASE`
- **Wrapper:** `VyrdxConfigPaths`
- **Bridge path:** `vyrdx-bridge/lib/config-paths.bridge.ts` ✅ exists

### db.js (20 lines)

- **Purpose:** PostgreSQL connection pool via `pg.Pool`
- **Inputs:** `DATABASE_URL` env
- **Outputs:** `initDB()`, `getDB()` → Pool
- **Side effects:** Creates persistent DB connection pool
- **Env deps:** `DATABASE_URL`
- **Wrapper:** `VyrdxDB`
- **Bridge path:** `vyrdx-bridge/lib/db.bridge.ts` ✅ exists

### redis.js (13 lines)

- **Purpose:** Redis client singleton
- **Inputs:** `REDIS_URL` env
- **Outputs:** `initRedis()`, `getRedis()` → RedisClient
- **Side effects:** Creates persistent Redis connection
- **Env deps:** `REDIS_URL`
- **Wrapper:** `VyrdxRedis`
- **Bridge path:** `vyrdx-bridge/lib/redis.bridge.ts` ✅ exists

### journal.js (28 lines)

- **Purpose:** Read/verify JSONL journal and hash chain files
- **Inputs:** File paths
- **Outputs:** `readJournalLines(path)`, `readChainLines(path)`, `verifyChain(lines)`
- **Side effects:** FS reads
- **Env deps:** None (paths passed as args)
- **Wrapper:** `VyrdxJournal`
- **Bridge path:** `vyrdx-bridge/lib/journal.bridge.ts` ✅ exists

### utils.js (51 lines)

- **Purpose:** Utility functions: JSON file I/O, SHA-256, timestamps, math
- **Inputs:** File paths, data
- **Outputs:** `readJson(path)`, `writeJson(path, data)`, `sha(str)`, `nowIso()`, `clamp(v, lo, hi)`, `median(arr)`, `appendLog(path, line)`
- **Side effects:** FS reads/writes
- **Env deps:** None
- **Wrapper:** `VyrdxUtils`
- **Bridge path:** `vyrdx-bridge/lib/utils.bridge.ts` ✅ exists

---

## core/modules/ — Runtime engine modules

### analytics.js (35 lines)

- **Purpose:** Cross-correlate market/health/risk state files, compute composite analytics
- **Inputs:** State files: market-model.json, system-health.json, risk-profile.json
- **Outputs:** Analytics snapshot written to state
- **Side effects:** Reads 3 state files, writes analytics
- **Env deps:** Hardcoded paths under `/opt/vyrdx/core/state/`
- **FS deps:** market-model.json, system-health.json, risk-profile.json, analytics-result.json
- **Wrapper:** `VyrdxAnalyticsBridge`
- **Bridge path:** `vyrdx-bridge/modules/analytics.bridge.ts` ✅ exists

### hardware.js (36 lines)

- **Purpose:** Collect system hardware metrics (CPU, memory, uptime, load)
- **Inputs:** `os` module, system-health.json
- **Outputs:** Hardware snapshot
- **Side effects:** Writes to system-health.json
- **Env deps:** None
- **FS deps:** system-health.json
- **Wrapper:** `VyrdxHardwareBridge`
- **Bridge path:** `vyrdx-bridge/modules/hardware.bridge.ts` ✅ exists

### health.js (48 lines)

- **Purpose:** System health check — DB ping, Redis ping, state file status
- **Inputs:** DB pool, Redis client, state files
- **Outputs:** Health report
- **Side effects:** Writes to system-health.json
- **Env deps:** `DATABASE_URL`, `REDIS_URL` (via lib/db, lib/redis)
- **FS deps:** system-health.json
- **Wrapper:** `VyrdxHealthBridge`
- **Bridge path:** `vyrdx-bridge/modules/health.bridge.ts` ✅ exists

### market.js (50 lines)

- **Purpose:** Market data processor — reads from Redis feed cache, computes model
- **Inputs:** Redis (feed-engine cached prices), config file
- **Outputs:** Market model written to state
- **Side effects:** Reads Redis, writes market-model.json
- **Env deps:** `REDIS_URL` (via lib/redis)
- **FS deps:** market-model.json, vyrdox config
- **Wrapper:** `VyrdxMarketBridge`
- **Bridge path:** `vyrdx-bridge/modules/market.bridge.ts` ✅ exists

### opportunity.js (35 lines)

- **Purpose:** Opportunity detection based on market signals and strategy config
- **Inputs:** Config file, strategy file, market state
- **Outputs:** Opportunity snapshot
- **Side effects:** Reads config+strategy, writes opportunity state
- **Env deps:** None
- **FS deps:** vyrdox config, strategy file, opportunity-result.json
- **Wrapper:** `VyrdxOpportunityBridge`
- **Bridge path:** `vyrdx-bridge/modules/opportunity.bridge.ts` ✅ exists

### security.js (48 lines)

- **Purpose:** Security audit — journal integrity, chain verification, anomaly scan
- **Inputs:** Journal files, chain files, config
- **Outputs:** Security report
- **Side effects:** Reads journal/chain files, writes security state
- **Env deps:** None
- **FS deps:** journal files, chain files, security-result.json
- **Wrapper:** `VyrdxSecurityBridge`
- **Bridge path:** `vyrdx-bridge/modules/security.bridge.ts` ✅ exists

### supervision.js (81 lines)

- **Purpose:** Master supervision — orchestrates all other modules, enforces law/directive
- **Inputs:** DB, Redis, all state files, config, directive, law
- **Outputs:** Supervision report, directive enforcement actions
- **Side effects:** Reads all state, writes supervision state, may trigger corrective actions
- **Env deps:** `DATABASE_URL`, `REDIS_URL` (via lib)
- **FS deps:** All state files, config, directive, law
- **Wrapper:** `VyrdxSupervisionBridge`
- **Bridge path:** `vyrdx-bridge/modules/supervision.bridge.ts` ✅ exists

---

## core/bin/ — Entry scripts

### vyrdox.js (60 lines)

- **Purpose:** Main runtime entry. Boots DB+Redis, runs all 7 modules in sequence.
- **Inputs:** `.env` file, env vars
- **Outputs:** Console logs, state file updates
- **Side effects:** DB/Redis init, module execution, state writes
- **Env deps:** `DATABASE_URL`, `REDIS_URL`, `VYRDOX_CORE_BASE`
- **Module execution order:** hardware → health → market → analytics → opportunity → security → supervision
- **Wrapper:** `VyrdxBootBridge`
- **Bridge path:** `vyrdx-bridge/bin/vyrdox.bridge.ts` ✅ exists

### codex.js (1 line)

- **Purpose:** Re-exports vyrdox.js
- **Wrapper:** `VyrdxCodexBridge` (alias)
- **Bridge path:** `vyrdx-bridge/bin/codex.bridge.ts` ✅ exists

---

## services/ — Standalone service processes

### attest-verify.js (140 lines, CJS)

- **Purpose:** ExecStartPre for feed/chain/codex systemd services. Verifies attestation token validity.
- **Inputs:** Token file, public key file, env vars
- **Outputs:** Exit 0 (pass) or exit 1 (fail). Supports degraded mode.
- **Side effects:** Reads token/key files, optionally allows degraded operation
- **Env deps:** `ATTESTATION_TOKEN_PATH`, `ATTESTATION_PUBKEY_PATH`, `ATTESTATION_MODE`, `ATTESTATION_REQUIRED`, `ATTESTATION_DEGRADED_TTL_SECONDS`
- **FS deps:** `/opt/vyrdx/tokens/attest.token`, `/opt/vyrdx/secure/asus_authority.pub`
- **Wrapper:** `VyrdxAttestVerifyBridge`
- **Bridge path:** `vyrdx-bridge/services/attest-verify.bridge.ts` ✅ exists

### chain-verifier.js (59 lines, CJS)

- **Purpose:** HTTP service on :9201. Exposes `/verify` endpoint for on-chain seal verification.
- **Inputs:** `CHAIN_RPC_URL`, `SEAL_CONTRACT_ADDRESS` env vars
- **Outputs:** HTTP responses with verification results
- **Side effects:** Makes RPC calls to Arbitrum chain
- **Env deps:** `CHAIN_RPC_URL`, `SEAL_CONTRACT_ADDRESS`, `PORT`
- **Wrapper:** `VyrdxChainVerifierBridge`
- **Bridge path:** `vyrdx-bridge/services/chain-verifier.bridge.ts` ✅ exists

### feed-engine.js (60 lines, CJS)

- **Purpose:** HTTP service on :9202. Market price poller → Redis cache.
- **Inputs:** `MARKET_HTTP_URL`, `MARKET_POLL_MS` env vars
- **Outputs:** Redis writes, `/health` endpoint
- **Side effects:** Polls external API, writes to Redis
- **Env deps:** `MARKET_HTTP_URL`, `MARKET_POLL_MS`, `REDIS_URL`, `PORT`
- **Wrapper:** `VyrdxFeedEngineBridge`
- **Bridge path:** `vyrdx-bridge/services/feed-engine.bridge.ts` ✅ exists

### rtmp-auth.js (60 lines, CJS)

- **Purpose:** HTTP auth hook on :18080 for MediaMTX RTMP stream authentication.
- **Inputs:** HTTP request with stream key
- **Outputs:** 200 (allow) or 403 (deny)
- **Side effects:** Validates stream keys against allowlist
- **Env deps:** `RTMP_AUTH_PORT`, `RTMP_STREAM_KEYS`
- **Wrapper:** `VyrdxRtmpAuthBridge`
- **Bridge path:** `vyrdx-bridge/services/rtmp-auth.bridge.ts` ✅ exists

### refresh-attestation-token-remote.js (151 lines, CJS)

- **Purpose:** SSH-based token refresh to ASUS authority node. Runs as systemd timer.
- **Inputs:** SSH key, authority host/port
- **Outputs:** Writes refreshed token to token file
- **Side effects:** SSH connection, file write
- **Env deps:** `ASUS_SSH_KEY`, `ASUS_HOST`, `ASUS_PORT`, `ATTESTATION_TOKEN_PATH`
- **FS deps:** SSH key file, token file
- **Wrapper:** `VyrdxTokenRefreshBridge`
- **Bridge path:** `vyrdx-bridge/services/token-refresh.bridge.ts` ✅ exists

---

## Runtime/Source Divergence Notes

| Area         | Runtime (/opt/vyrdx)                      | Source (KITTY)                                        | Divergence                                    |
| ------------ | ----------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| Config paths | Hardcoded `/opt/vyrdx/core/...`           | Uses `KITTY_ROOT` env                                 | Paths don't overlap — bridge must translate   |
| DB/Redis     | Real connections via pg/ioredis           | No DB layer in KITTY source                           | Bridge wraps runtime DB                       |
| Evidence     | Journal/chain in `/opt/vyrdx/core/state/` | Evidence layer in `evidence/` with its own hash chain | Separate chains — no automatic sync           |
| Modules      | 7 JS modules with state files             | 88 TS engine classes                                  | Source engines are higher-level orchestrators |
| Services     | 5 systemd services                        | No service process in source                          | Source has no `listen()`                      |
| Auth         | ed25519 attestation with ASUS authority   | No auth implementation                                | Bridge reads attestation state                |

## Systemd Service Map

| Service                   | Binary                                       | Port  | Status           | Mode                |
| ------------------------- | -------------------------------------------- | ----- | ---------------- | ------------------- |
| vyrdx-engine              | core/bin/vyrdox.js                           | —     | active (exited)  | oneshot OK          |
| vyrdx-core                | core/bin/vyrdox.js                           | —     | active (running) | DEGRADED_READONLY   |
| vyrdx-feed                | services/feed-engine.js                      | 9202  | active (running) | DEGRADED_READONLY   |
| vyrdx-chain               | services/chain-verifier.js                   | 9201  | active (running) | DEGRADED_READONLY   |
| vyrdx-codex               | core/bin/codex.js                            | —     | active (running) | DEGRADED_READONLY   |
| vyrdx-rtmp-auth           | services/rtmp-auth.js                        | 18080 | active (running) | NORMAL              |
| vyrdx-key-guard           | —                                            | —     | active (exited)  | timer (15min)       |
| vyrdx-attestation-refresh | services/refresh-attestation-token-remote.js | —     | inactive         | timer (5min)        |
| vyrdx-cold-snapshot       | —                                            | —     | inactive         | timer               |
| vyrdx-daily-inspection    | —                                            | —     | **failed**       | timer (daily 20:00) |
| vyrdx-hash-anchor         | —                                            | —     | **failed**       | timer               |
| vyrdx-terminal            | —                                            | —     | inactive         | —                   |
| vyrdx-tv                  | —                                            | —     | inactive         | —                   |

> **Updated 2026-04-16:** Services previously reported as "CRASH" are actually running in DEGRADED_READONLY mode. They entered degraded state at ~22:55 UTC Apr 15 due to attestation token expiry. ASUS authority host (100.127.85.101) is unreachable, preventing token refresh.

## Missing Bridge Wrapper

| Runtime file                                   | Proposed wrapper          | Status      |
| ---------------------------------------------- | ------------------------- | ----------- |
| `services/refresh-attestation-token-remote.js` | `VyrdxTokenRefreshBridge` | NOT CREATED |

All other runtime modules have typed bridge wrappers in `vyrdx-bridge/`.
