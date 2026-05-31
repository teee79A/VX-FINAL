# Governance Model

As of `2026-04-17`, the active VYRDON contract deployment is a Safe-governed, immutable-core system.

## Final Authority

- Canonical Safe: `0x7b281C5d9F863e50264aA7F7583C2d5626ed4501`
- Safe threshold: `2`
- Safe owners:
  - `0xF46104e2CE5772dfd277B5E781f11fCad5902331`
  - `0xBB80da12B9C2c8d6cD3b495BcA07D12291824bA7`

## Active Governance Statement

- Safe is the final authority in the active deployment.
- No active EOA owner or admin was found on the active contract set.
- `VyrdonBoundary` is Safe-controlled.
- `ExecutionSeal`, `EscrowVault`, `VyrdonCore`, `ASRSATAIntentAnchor`, and `ASRSATA` are immutable ownerless contracts.
- The active deployment is not using an upgradeable proxy layer for these contracts.
- No active timelock is present in the current deployment.
- No active guardian is present in the current deployment.

## Allowed External Positioning

State the system this way:

- Safe-governed execution system
- Immutable contract core
- No EOA admin risk in the active contract set
- Live verifiable execution

## Do Not Claim

Do not state any of the following unless the deployment changes and the register is updated:

- `timelock-governed`
- `guardian-controlled`
- `upgradeable governance layer`
- `future-controlled contracts`

## Runtime Scope Note

This governance model covers the active contract deployment and authority statement. It does not imply that every planned runtime surface is live.

As of `2026-04-17`:

- `https://vyrdx.vyrdon.com/api/health` is live
- `https://vyrdx.vyrdon.com/api/build` is live
- the public seal flow is live:
  - `POST /api/v1/seal`
  - `GET /api/v1/seals`
  - `GET /api/v1/verify/:hash`
  - `GET /proof/:sealId`
- `/rooms/commercial`
- `/rooms/operations`
- `/rooms/evidence`
- `/rooms/camps`
- `/rooms/policy`

All five `/rooms/*` routes currently return `404`, so they must not be described as live runtime surfaces.
