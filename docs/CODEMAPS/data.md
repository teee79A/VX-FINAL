<!-- Generated: 2026-04-17 | Files scanned: 142 | Token estimate: ~500 -->

# Data Codemap

## Evidence Chain (KITTY-side)

```
evidence/
├── hash-chain.ts     → SHA-256 append-only chain (file: data/hash-chain.head)
├── jsonl.sink.ts     → JSONL audit log (file: evidence/journal/command_bus.audit.jsonl)
├── evidence.writer.ts → writeDecision(): sink → verify → commitHash → backbone
└── evidence.layer.ts  → EvidenceLayer facade
```

| Artifact | Path | Format | Write Pattern |
|----------|------|--------|---------------|
| Hash chain head | `$KITTY_HASH_HEAD` | single hash string | atomic tmp+rename |
| Audit journal | `$KITTY_COMMAND_AUDIT_FILE` | JSONL, 1 record/line | serialized append via writeQueue |
| Evidence records | in-memory backbone | `EvidenceRecord[]` | insertEvidence() after hash commit |

## VYRDX Runtime State Files (/opt/vyrdx/core/state/)

| State File | Writer Module | Reader Bridge | Content |
|------------|--------------|---------------|---------|
| `system-health.json` | hardware.js, health.js | `hardware.bridge.ts`, `health.bridge.ts` | CPU, mem, uptime, DB/Redis ping |
| `market-model.json` | market.js | `market.bridge.ts` | BTC price, volatility, trend |
| `analytics-result.json` | analytics.js | `analytics.bridge.ts` | Cross-correlation of health+market+risk |
| `opportunity-result.json` | opportunity.js | `opportunity.bridge.ts` | Signal count, confidence |
| `security-result.json` | security.js | `security.bridge.ts` | Journal integrity, chain OK |
| `supervision-result.json` | supervision.js | `supervision.bridge.ts` | Divergence, drift, RSS |

## VYRDX Configuration Files (/opt/vyrdx/configs/)

| File | Purpose | Schema |
|------|---------|--------|
| `chain.json` | Arbitrum Sepolia RPC + seal contract address | `{ rpc, chainId, sealAddress, boundaryAddress }` |
| `directive.json` | Execution authority flag | `{ execution_authority: false }` |
| `law.json` | VYRDON LAW immutable rules | `{ rules: [...] }` |
| `strategy.json` | Trading/opportunity parameters | `{ thresholds, risk_limits }` |

## VYRDX Token/Key Files (/opt/vyrdx/)

| File | Purpose | Format |
|------|---------|--------|
| `tokens/attest.token` | Active attestation token | JSON: `{ payload, signature, quorumSatisfied }` |
| `secure/asus_authority.pub` | Authority Ed25519 public key | PEM |
| `secure/asus_authority.fingerprint` | Key fingerprint | hex SHA-256 |
| `secure/bootstrap/asus_authority_bootstrap_public.pem` | Bootstrap key | PEM |
| `secure/keys/execution/execution_key_{1,2}.pub` | Execution keys | PEM |
| `secure/keys/recovery/recovery_key_{1,2,3}.pub` | Recovery keys | PEM |
| `secure/key-policy.json` | Key rotation policy | EMPTY (0 bytes — gap) |

## Degraded State Files (/opt/vyrdx/run/)

| File | Written By | Content |
|------|-----------|---------|
| `attestation_degraded_vyrdx-chain.json` | attest-verify.js | `{ mode, reason, entered }` |
| `attestation_degraded_vyrdx-codex.json` | attest-verify.js | `{ mode, reason, entered }` |
| `attestation_degraded_vyrdx-core.json` | attest-verify.js | `{ mode, reason, entered }` |
| `attestation_degraded_vyrdx-feed.json` | attest-verify.js | `{ mode, reason, entered }` |

## Redis Streams (VYRDX runtime)

| Key | Type | Writer | Growth |
|-----|------|--------|--------|
| `market:BTCUSDT:last` | string | feed-engine.js | overwrite |
| `market-stream` | XADD stream | feed-engine.js | ~1M+ entries |

## ConsoLab Evidence (/home/t79/ASUS_AUTHORITY/)

| File | Purpose | Format |
|------|---------|--------|
| `evidence/signing.jsonl` | Authority signing log | JSONL |
| `state/heartbeat.json` | Node heartbeat state | JSON |
| `keys/signing.key` | Authority private key | PEM (mode 0600) |
| `keys/signing.pub` | Authority public key | PEM |
