# VYRDON

**Execution Certification Protocol**

VYRDON creates tamper-proof, cryptographically sealed records for every action a business completes. Each record is SHA-256 hashed, chain-linked to its predecessor, and published as a verifiable proof page that anyone can inspect.

This is not a dashboard. This is not a project management tool. This is proof infrastructure.

**Live:** [vyrdx.vyrdon.com](https://vyrdx.vyrdon.com)

---

## What VYRDON Does

```
Certify action → Issue proof link → Share proof → Build trust
```

Every certificate is:

- **Cryptographically sealed** — SHA-256 hash of the canonical payload
- **Chain-linked** — each seal references the previous hash and sequence number
- **Publicly verifiable** — proof pages are live, shareable, and independently checkable
- **Permanent** — sealed records cannot be modified or deleted

## Architecture

VYRDON operates across four boundaries:

| Node | Role |
|------|------|
| **VYRDx Cloud** (`vyrdx.vyrdon.com`) | Customer product — certificates, proof pages, billing, public API |
| **KITTY / VXSTATION** | Operator plane — 98 engines, 7 rooms, command bus, evidence chain |
| **VYRDX Runtime** (`/opt/vyrdx`) | Execution engine — policy modules, journal chain, seal verification |
| **ConsoLab** (ASUS) | Authority plane — key signing, governance, multi-signature |

## Product Surface (VYRDx Cloud)

### Public Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing — conversion entry |
| `/certify` | Create a certificate |
| `/pricing` | Plans and one-time pricing |
| `/billing` | Usage tracking and upgrades |
| `/proof/:id` | Public proof page (server-rendered) |

### API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/seals` | POST | Create a certificate |
| `/api/v1/proofs/:id` | GET | Get proof data (JSON) |
| `/api/v1/proofs/verify` | POST | Verify proof integrity |
| `/api/v1/usage` | GET | Usage stats |
| `/api/v1/my/seals` | GET | List user certificates |
| `/api/v1/billing/paypal/*` | POST | Payment flows |

### Pricing

| Tier | Price | Certificates |
|------|-------|-------------|
| Free trial | $0 | 5 certificates |
| One-time | $2 | 1 certificate |
| CERTIFIED | $49/mo | 200/mo |
| CERTIFIED PRO | $149/mo | 1,000/mo |
| ENTERPRISE | $499/mo | 5,000/mo + escrow + on-chain |

## Operator Plane (KITTY / VXSTATION)

98 engines across 10 groups, booted by `bootStation()`:

- **CEO Layer** — 10 engine layers + 10 server layers + conductor
- **Security** — 10 engines (ABYSSAL red team, perimeter, vault)
- **Engineering** — 12 engines (build, deploy, CI/CD)
- **Infrastructure** — 12 engines (network, DNS, cloud)
- **Financial** — 11 engines (treasury, gas, billing)
- **Director** — 7 engines (VYRDOX orchestrator)
- **Server** — 7 engines (runtime API, gateway, MCP)
- **Interconnect** — 5 engines (bridge, handshake, topology)
- **Governance** — 3 engines (policy, compliance, audit)

### Rooms

| Room | Purpose |
|------|---------|
| Commercial | Revenue, billing, renewals, MRR tracking |
| Operations | System health, incidents, deploys, uptime |
| Evidence | Seal chain, proofs, integrity verification |
| Camp | About VYRDON, VYRDx, contact, license, T&C |
| Policy | Governance, approvals, access reviews |
| Market | Intelligence, trends, competitor signals |
| Reports | Summaries, deadlines, planning |

### 7 AI Agents

| Badge | Name | Role |
|-------|------|------|
| SEC-1 | ABYSSAL | Red Team / Security |
| CFO-1 | LEVERAGE | Chief Financial |
| REV-1 | MAMMON | Strategic CEO |
| ENG-1 | OBSIDIAN | Engineering Lead |
| ENG-2 | THUNDER | Engineering Ops |
| BIZ-1 | TITAN | Business Intelligence |
| DIR-1 | VYRDOX | Director / Orchestrator |

## VYRDON Law — Immutable

```
1. Execution without evidence is void.
2. Agents are identified, not anonymous. Every agent has a badge.
3. The seal cannot be retroactively modified.
4. AI Room and Runtime are separated by architecture.
5. Security operations are visible. No cover. Every scan badged and sealed.
6. Financial operations require multi-signature.
7. The protocol is the law. The running code is VYRDON.
```

## Technical Foundation

- **Language:** TypeScript (strict mode, ESM, NodeNext)
- **Server:** Fastify on port 7800
- **Database:** PostgreSQL (seals, proofs, workspaces, usage periods, billing events)
- **Hash chain:** SHA-256, canonical JSON, append-only, GENESIS root
- **Frontend:** React SPA (Vite build), Three.js 3D room scene
- **Deploy:** rsync + systemd to DigitalOcean droplet
- **Tunnel:** Cloudflare Zero Trust → `vyrdx.vyrdon.com`
- **Payments:** PayPal (primary), Stripe (secondary, post-LLC)

## Command Bus

All operator actions route through the command bus with:

- Idempotency + replay guard
- Deterministic fingerprinting
- Hash-linked evidence records
- Policy-gated execution
- Capability-based bridge routing

## Evidence Chain

- Append-only JSONL audit journals
- Atomic writes (write-tmp-rename pattern)
- GENESIS hash as chain root
- Every command execution produces evidence records
- Missing evidence in critical paths = stop condition

## Build & Validate

```bash
npx tsc --noEmit          # Type check
npx vitest run            # 233 tests
npm run lint              # ESLint
npm run ci:mandatory      # All of the above
bash deploy/deploy.sh     # Deploy to production
```

## Contact

- **General:** contact@vyrdon.com
- **Authority & Governance:** authority@vyrdon.com
- **Verification & Proof Support:** verification@vyrdon.com

---

© 2026 VYRDON — Execution Certification Protocol
