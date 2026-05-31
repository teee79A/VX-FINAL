# RUNTIME RECOVERY REVIEW

> Track: 4 — Runtime Recovery Operator  
> Path: `/opt/vyrdx`  
> Author: Claude Terminal (Track 3, acting as Track 4 auditor)  
> Date: 2026-04-17  

---

## 1. Attestation Token State

| Field | Value |
|-------|-------|
| File | `/opt/vyrdx/tokens/attest.token` |
| nodeId | `t79` |
| releaseId | `REL-ASUS-20260416` |
| issuedAtUTC | `2026-04-16T07:08:53.605Z` |
| expiresAtUTC | `2026-04-16T07:28:53.605Z` |
| Signature length | 88 chars (Ed25519 base64) |
| quorumSatisfied | true |
| **Status** | **EXPIRED** (>17 hours ago) |

### Token Refresh Path

```
VYRDX service → /opt/vyrdx/services/refresh-attestation-token-remote.js
  → POST http://100.127.85.101:7900/api/attestation/refresh
  → ASUS ConsoLab signs new token (Ed25519)
  → Writes /opt/vyrdx/tokens/attest.token
```

**Blocker**: ASUS authority at `100.127.85.101` is **UNREACHABLE** (Tailscale link down, 100% packet loss). Token cannot refresh until ASUS comes online or Tailscale is repaired.

### Refresh Timer

```
vyrdx-attestation-refresh.timer → every 5 min
  → ExecStart=/usr/bin/node /opt/vyrdx/services/refresh-attestation-token-remote.js
  → Fails silently each cycle (connection refused / timeout)
```

---

## 2. Degraded Services (4 of 4 attested services)

All 4 services entered `DEGRADED_READONLY` when token expired:

| Service | Degraded File | Entered | Expires |
|---------|--------------|---------|---------|
| vyrdx-chain | `/opt/vyrdx/run/attestation_degraded_vyrdx-chain.json` | 2026-04-15T22:55:44Z | 2026-04-16T22:55:44Z |
| vyrdx-codex | `/opt/vyrdx/run/attestation_degraded_vyrdx-codex.json` | 2026-04-15T22:55:44Z (t79) | 2026-04-16T22:55:44Z |
| vyrdx-core | `/opt/vyrdx/run/attestation_degraded_vyrdx-core.json` (vyrdon) | 2026-04-15T22:55:44Z | 2026-04-16T22:55:44Z |
| vyrdx-feed | `/opt/vyrdx/run/attestation_degraded_vyrdx-feed.json` | 2026-04-15T22:55:44Z | 2026-04-16T22:55:44Z |

**Reason code**: `ATTESTATION_TOKEN_EXPIRED`  
**Impact**: Services are running but in read-only mode — no writes, no execution, no market actions.  
**Degraded expiry**: 24h window means services will drop to `HALTED` after `2026-04-16T22:55Z` if not recovered.

---

## 3. Failed Systemd Units

### vyrdx-daily-inspection.service — FAILED

```
Active: failed (Result: exit-code) since Wed 2026-04-15 20:00:00 EAT
Exit status: 226/NAMESPACE
```

**Root cause**: `Failed to set up mount namespacing: /home/t79/.config/vyrdon: No such file or directory`

**Fix**: Create the directory:
```bash
mkdir -p /home/t79/.config/vyrdon
systemctl restart vyrdx-daily-inspection.service
```

### vyrdx-hash-anchor.service — FAILED

```
Active: failed (Result: exit-code) since Thu 2026-04-16 00:05:11 EAT
Exit status: 2/INVALIDARGUMENT
Log: SEALCHECK: FAIL
```

**Root cause**: `sealcheck` binary fails — likely cannot reach Arbitrum Sepolia RPC or anchor hash is stale.

**Fix**: Requires:
1. Valid attestation token (currently expired)
2. Working Arbitrum RPC connection
3. Fresh hash chain head from `/opt/vyrdx/core/state/`

---

## 4. Running Processes

| PID | User | Service | Binary |
|-----|------|---------|--------|
| 3347 | vvrdnx | rtmp-auth | `/opt/vyrdx/services/rtmp-auth.js` |
| 219947 | t79 | vyrdx-feed | `/opt/vyrdx/services/feed-engine.js` |
| 219969 | t79 | vyrdx-chain | `/opt/vyrdx/services/chain-verifier.js` |
| 220023 | vyrdon | vyrdx-codex | `/opt/vyrdx/core/bin/codex.js` |
| 220936 | t79 | vyrdx-engine | `/opt/vyrdx/vyrdox/engine/src/index.js` |

All processes are **running** but operating in **DEGRADED_READONLY** mode due to expired attestation.

---

## 5. Entrypoint Candidates

| Module | Entrypoint | Purpose |
|--------|-----------|---------|
| Core engine | `/opt/vyrdx/core/bin/vyrdox.js` | Main orchestrator (runs as codex.js) |
| Chain verifier | `/opt/vyrdx/services/chain-verifier.js` | On-chain hash verification |
| Feed engine | `/opt/vyrdx/services/feed-engine.js` | Market data feed + Redis stream |
| RTMP auth | `/opt/vyrdx/services/rtmp-auth.js` | Media stream auth |
| Attest verify | `/opt/vyrdx/services/attest-verify.js` | Token validation loop |
| Token refresh | `/opt/vyrdx/services/refresh-attestation-token-remote.js` | Remote token refresh |
| Deterministic engine | `/opt/vyrdx/vyrdox/engine/src/index.js` | Deployment engine |

---

## 6. Permission Issues

| Path | Owner | Issue |
|------|-------|-------|
| `/opt/vyrdx/tokens/` | root:t79 (drwxrwxr-x) | OK — t79 can write |
| `attestation_degraded_vyrdx-core.json` | vyrdon:vyrdon | Mismatch — other degraded files owned by t79 |
| `/home/t79/.config/vyrdon/` | — | **MISSING** — causes daily-inspection NAMESPACE failure |
| `/opt/vyrdx/secure/key-policy.json` | — | **EMPTY** (0 bytes) — no key rotation policy |

---

## 7. Files Reviewed

```
/opt/vyrdx/tokens/attest.token
/opt/vyrdx/run/attestation_degraded_vyrdx-chain.json
/opt/vyrdx/run/attestation_degraded_vyrdx-codex.json
/opt/vyrdx/run/attestation_degraded_vyrdx-core.json
/opt/vyrdx/run/attestation_degraded_vyrdx-feed.json
/opt/vyrdx/services/refresh-attestation-token-remote.js
/opt/vyrdx/services/attest-verify.js
/opt/vyrdx/services/chain-verifier.js
/opt/vyrdx/services/feed-engine.js
/opt/vyrdx/services/rtmp-auth.js
/opt/vyrdx/core/bin/codex.js
/opt/vyrdx/core/bin/vyrdox.js
/opt/vyrdx/vyrdox/engine/src/index.js
/opt/vyrdx/configs/chain.json
/opt/vyrdx/configs/directive.json
/opt/vyrdx/secure/key-policy.json
systemd units: vyrdx-daily-inspection, vyrdx-hash-anchor, vyrdx-attestation-refresh
```

---

## 8. Files to Patch

| File | Action | Owner |
|------|--------|-------|
| `/home/t79/.config/vyrdon/` | Create directory | Track 4 (manual) |
| `/opt/vyrdx/secure/key-policy.json` | Write rotation policy | Track 4 |
| systemd: vyrdx-daily-inspection | Restart after dir fix | Track 4 (manual) |
| systemd: vyrdx-hash-anchor | Restart after token refresh | Track 4 (manual) |
| Tailscale / ASUS network | Repair link to 100.127.85.101 | Manual / hardware |

---

## 9. What Can Be Safely Restarted

| Service | Safe? | Reason |
|---------|-------|--------|
| vyrdx-daily-inspection | YES (after dir fix) | Read-only inspection, no state mutation |
| vyrdx-hash-anchor | NO | Needs valid attestation + Arbitrum RPC |
| vyrdx-feed | YES | Stateless feed → Redis, will re-enter degraded |
| vyrdx-chain | YES | Stateless verifier, will re-enter degraded |
| vyrdx-codex | CAUTION | Runs as vyrdon user, state-heavy |
| rtmp-auth | YES | Stateless auth service |

---

## 10. Blockers

1. **ASUS unreachable** — Tailscale link to 100.127.85.101 is down. Cannot refresh attestation token.
2. **Token expired >17h** — All 4 services in DEGRADED_READONLY approaching HALTED threshold.
3. **Missing directory** — `/home/t79/.config/vyrdon/` prevents daily-inspection from running.
4. **Empty key-policy.json** — No key rotation policy defined (0 bytes).
5. **Sealcheck failing** — Hash anchor cannot run without valid attestation + RPC.

---

## 11. Additional Findings (from VYRDX Runtime Audit Agent)

### CRITICAL

| # | Finding | Path | Impact |
|---|---------|------|--------|
| C1 | Core state directory EMPTY | `/opt/vyrdx/core/state/` | All analytics, risk scoring, supervision blocked — modules produce no output |
| C2 | DB password env var has no fallback | `core/lib/db.js` → `VYRDOX_DB_PASSWORD` | Health checks fail silently → health score 0 → cascading analytics failure |

### HIGH

| # | Finding | Path | Impact |
|---|---------|------|--------|
| H1 | Enforcement directory EMPTY | `/opt/vyrdx/enforcement/` | `journal-append.sh` missing — journal enforcement broken |
| H2 | Stale .bak files in services/ | `attest-verify.js.bak`, `refresh-token.js.bak` | Stale rollback artifacts, potential config confusion |
| H3 | Journal minimal (3 lines) | `/opt/vyrdx/journal/action.log` | Production anomaly — expected continuous journal entries |
| H4 | Config duplication | `vyrdox.json` + `codex.json` with overlapping keys | Potential config divergence |
| H5 | Thermal sensor requires root | `core/modules/hardware.js` | Silently fails for non-root users |
| H6 | Hardcoded ports, no circuit breaker | All services | No retry/fallback on port conflicts |

### CONSTRAINTS (Hard-Enforced, Do NOT Change)

- `directive.json`: `execution_authority: false`, `private_key_access: false` — **IMMUTABLE**
- Supervision module: hard-exits process if directive violated or RSS > 512MB
- Law script: 5 immutable rules checked every 4 seconds

---

## 12. Recovery Sequence (when ASUS comes online)

```
1. Verify Tailscale: ping 100.127.85.101
2. Refresh token: node /opt/vyrdx/services/refresh-attestation-token-remote.js
3. Verify token: cat /opt/vyrdx/tokens/attest.token | jq .payload.expiresAtUTC
4. Remove degraded flags: rm /opt/vyrdx/run/attestation_degraded_*.json
5. Restart services:
   systemctl restart vyrdx-chain vyrdx-feed vyrdx-core
   systemctl restart vyrdx-codex  # caution — vyrdon user
6. Fix daily-inspection: mkdir -p /home/t79/.config/vyrdon && systemctl restart vyrdx-daily-inspection
7. Re-run hash anchor: systemctl restart vyrdx-hash-anchor
8. Verify: systemctl status vyrdx-{chain,codex,core,feed,daily-inspection,hash-anchor}
```
