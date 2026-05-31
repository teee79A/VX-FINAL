# ASUS Authority Map

> Generated: 2026-04-16  
> Source: /opt/vyrdx/secure/, /opt/vyrdx/ops/sealcheck/main.go  
> Status: ACTIVE (host connectivity DEGRADED)

## Trust Chain

```
ASUS Authority (100.127.85.101)
│
├── Ed25519 Signing Key (asus_authority)
│   ├── Public Key: /opt/vyrdx/secure/asus_authority.pub
│   ├── Fingerprint: /opt/vyrdx/secure/asus_authority.fingerprint
│   └── Signs: attestation tokens (20-min TTL)
│
├── Bootstrap Key (separate Ed25519)
│   └── Public Key: /opt/vyrdx/secure/bootstrap/asus_authority_bootstrap_public.pem
│
├── Execution Keys (2)
│   ├── /opt/vyrdx/secure/keys/execution/execution_key_1.pub
│   └── /opt/vyrdx/secure/keys/execution/execution_key_2.pub
│
├── Recovery Keys (3)
│   ├── /opt/vyrdx/secure/keys/recovery/recovery_key_1.pub
│   ├── /opt/vyrdx/secure/keys/recovery/recovery_key_2.pub
│   ├── /opt/vyrdx/secure/keys/recovery/recovery_key_3.pub
│   └── /opt/vyrdx/secure/keys/recovery/manifest.json
│
└── Sealcheck Binary (Go)
    └── /opt/vyrdx/ops/bin/sealcheck
        ├── Profile: anchor → Arbitrum Sepolia hash anchor
        ├── Profile: attestation-refresh → SSH token refresh
        └── Profile: full → anchor + attestation + modules
```

## Key Material

### Authority Signing Key

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Algorithm        | Ed25519                                                            |
| Public Key       | `/opt/vyrdx/secure/asus_authority.pub`                             |
| Fingerprint      | `4593edb857c9e5c11f42d584bb6a87649cf8def2d8d873b977e85fa0bfd25bb1` |
| Fingerprint File | `/opt/vyrdx/secure/asus_authority.fingerprint`                     |
| Purpose          | Sign attestation tokens for runtime nodes                          |

```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAAccJ4QQ9eGwTm+JHGgAH6N2PLvp6GJ0CpWPku5oY7rg=
-----END PUBLIC KEY-----
```

### Bootstrap Key (Separate Key Pair)

| Field      | Value                                                             |
| ---------- | ----------------------------------------------------------------- |
| Algorithm  | Ed25519                                                           |
| Public Key | `/opt/vyrdx/secure/bootstrap/asus_authority_bootstrap_public.pem` |
| Purpose    | Initial trust establishment, key rotation bootstrap               |

```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAuhkjAZ/zIPLXt0qdMzCWEioXXT4UYHntiX5J5l7G1VQ=
-----END PUBLIC KEY-----
```

**Note:** Authority key and bootstrap key are different Ed25519 key pairs. Bootstrap key is used for initial trust establishment; authority key is used for ongoing attestation signing.

### Execution Keys (2)

| Key             | File                                                   | Status   |
| --------------- | ------------------------------------------------------ | -------- |
| execution_key_1 | `/opt/vyrdx/secure/keys/execution/execution_key_1.pub` | DEPLOYED |
| execution_key_2 | `/opt/vyrdx/secure/keys/execution/execution_key_2.pub` | DEPLOYED |

### Recovery Keys (3)

| Key            | File                                                 | Status   |
| -------------- | ---------------------------------------------------- | -------- |
| recovery_key_1 | `/opt/vyrdx/secure/keys/recovery/recovery_key_1.pub` | DEPLOYED |
| recovery_key_2 | `/opt/vyrdx/secure/keys/recovery/recovery_key_2.pub` | DEPLOYED |
| recovery_key_3 | `/opt/vyrdx/secure/keys/recovery/recovery_key_3.pub` | DEPLOYED |
| manifest       | `/opt/vyrdx/secure/keys/recovery/manifest.json`      | PRESENT  |

### Key Policy

| File                                | Status          |
| ----------------------------------- | --------------- |
| `/opt/vyrdx/secure/key-policy.json` | EMPTY (0 bytes) |

**Gap:** Key policy file exists but is empty. No quorum threshold, rotation schedule, or revocation rules are defined.

## Attestation Protocol

### Flow

```
ASUS Authority (100.127.85.101)
       │
       │ SSH (t79@100.127.85.101)
       │ runs: sign-attestation-token.js
       │
       ▼
 Token Payload:
   nodeId:      "t79"
   releaseId:   "REL-ASUS-20260416"
   pcrHash:     <sha256>
   imaLogHash:  <sha256>
   issuedAtUTC: <ISO8601>
   expiresAtUTC: <ISO8601> (+20 min)
       │
       │ Ed25519 sign(stable-stringify(payload))
       │
       ▼
 Token written to /opt/vyrdx/tokens/attest.token
   {
     payload: { ... },
     signature: <base64>,
     quorumSatisfied: 1,
     signerCount: 1
   }
```

### Token Lifecycle

| Parameter        | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| TTL              | 20 minutes                                                |
| Refresh interval | 5 minutes (systemd timer)                                 |
| Degraded TTL     | 3600 seconds (1 hour)                                     |
| Quorum required  | 1 signer                                                  |
| Signer count     | 1                                                         |
| Token path       | `/opt/vyrdx/tokens/attest.token`                          |
| Refresh script   | `/opt/vyrdx/services/refresh-attestation-token-remote.js` |
| Verification     | `/opt/vyrdx/services/attest-verify.js`                    |

### Verification Modes

| Mode                | Behavior                                           |
| ------------------- | -------------------------------------------------- |
| `STRICT`            | Reject if token expired or signature invalid       |
| `DEGRADED_READONLY` | Allow read-only operations for 1 hour after expiry |

### Current Token Status (as of audit)

| Field      | Value                                                    |
| ---------- | -------------------------------------------------------- |
| Issued     | 2026-04-16T02:55:01.049Z                                 |
| Expires    | 2026-04-16T03:15:01.049Z                                 |
| Status     | **EXPIRED**                                              |
| Mode       | DEGRADED_READONLY                                        |
| Root Cause | ASUS authority host (100.127.85.101) unreachable via SSH |

## Sealcheck Binary

| Field            | Value                                        |
| ---------------- | -------------------------------------------- |
| Source           | `/opt/vyrdx/ops/sealcheck/main.go`           |
| Binary           | `/opt/vyrdx/ops/bin/sealcheck`               |
| Language         | Go                                           |
| Chain            | Arbitrum Sepolia (chainId 421614)            |
| RPC              | `https://arbitrum-sepolia.publicnode.com`    |
| Seal Address     | `0x41dafe6c2620a902f521ccd92dcb3b99af187fa8` |
| Signer Allowlist | `0x8ebf18c980eb76a629D035F67eB9EE0f6a1DB762` |

### Profiles

| Profile               | What It Does                                   |
| --------------------- | ---------------------------------------------- |
| `anchor`              | Verify on-chain hash anchor against local hash |
| `attestation-refresh` | SSH to ASUS, refresh attestation token         |
| `full`                | Run anchor + attestation + all module checks   |
| `anchor-module`       | Verify specific module's hash anchor           |

## Systemd Configuration

### Attestation Mode

File: `/opt/vyrdx/systemd/10-attestation-mode.conf`

```
ATTESTATION_MODE=DEGRADED_READONLY
ATTESTATION_DEGRADED_TTL=3600
```

### Attestation Refresh

File: `/opt/vyrdx/systemd/10-sealcheck-attestation-refresh.conf`

```
SEALCHECK_ASUS_SIGNER=ssh://t79@100.127.85.101
SEALCHECK_QUORUM=1
SEALCHECK_TIMEOUT_MS=2500
```

### Hash Anchor

File: `/opt/vyrdx/systemd/10-sealcheck-hash-anchor.conf`

```
SEALCHECK_RPC=https://arbitrum-sepolia.publicnode.com
SEALCHECK_CHAIN_ID=421614
SEALCHECK_SIGNER=0x8ebf18c980eb76a629D035F67eB9EE0f6a1DB762
```

## Real vs Doc-Only Assessment

| Artifact              | Real (Verified) | Notes                                      |
| --------------------- | --------------- | ------------------------------------------ |
| Authority public key  | YES             | File exists, used by attest-verify.js      |
| Authority fingerprint | YES             | File exists, hash present                  |
| Bootstrap PEM         | YES             | File exists, different key from authority  |
| Execution keys (2)    | YES             | Files exist with Ed25519 public keys       |
| Recovery keys (3)     | YES             | Files exist with Ed25519 public keys       |
| Recovery manifest     | YES             | File exists                                |
| Key policy            | NO              | File exists but EMPTY (0 bytes)            |
| Attestation token     | YES             | Token exists but EXPIRED                   |
| Token refresh (SSH)   | YES             | Script exists, systemd timer active        |
| Token verification    | YES             | attest-verify.js actively used by services |
| Sealcheck binary      | YES             | Compiled Go binary at ops/bin/sealcheck    |
| On-chain seal         | YES             | Contract at 0x41da... on Arbitrum Sepolia  |
| ASUS SSH access       | DEGRADED        | Host 100.127.85.101 unreachable (Tailnet?) |

## Gaps

| ID  | Severity | Description                                                                 |
| --- | -------- | --------------------------------------------------------------------------- |
| A1  | CRITICAL | ASUS authority host unreachable — attestation tokens cannot refresh         |
| A2  | HIGH     | key-policy.json is empty — no quorum/rotation/revocation rules defined      |
| A3  | MEDIUM   | Bootstrap key purpose undocumented — no bootstrap rotation procedure exists |
| A4  | LOW      | Recovery manifest.json content not validated against actual key files       |
