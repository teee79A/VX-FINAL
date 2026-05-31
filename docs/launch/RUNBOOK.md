# VYRDX Launch Runbook

## Launch Lock

VYRDX launch readiness means the gate cannot lie:

- No scope -> no case.
- No case -> no verify.
- No verify pass -> no certify.
- No authority -> no access.
- No payment, CRM, outreach, proposal, deploy, monitoring, or flyer feedback motion without IQ200 PASS plus the required Q201 state.
- No evidence stamp -> no completion.

## Required Gates

Run from `/home/t79/KITTY`:

```bash
git rev-parse HEAD
npm run check
npm test
DATABASE_URL='postgresql://vyrdx:<local-password>@127.0.0.1:55432/vyrdx_launch' scripts/launch/smoke
```

## Runtime Config

Health check:

```bash
curl -s http://127.0.0.1:7800/api/vyrdx/launch/runtime-config
```

Required payment DB variable:

- `DATABASE_URL`: PostgreSQL connection string used by `/api/v1/payments/request`.

Required CRM dispatcher variables:

- `CRM_DISPATCHER_URL`
- `CRM_DISPATCHER_TOKEN`

Missing payment DB config returns `decision=INCOMPLETE_RUNTIME_CONFIG` and `nextAction=SET_ENV_VARS_AND_RERUN_SMOKE`.
Missing CRM dispatcher config returns `decision=INCOMPLETE_INTEGRATION_CONFIG` and `nextAction=SET_ENV_VARS_AND_RERUN_SMOKE`.

The health check emits `config_missing` or `config_ready` into both `launch-runtime` and `launch-revenue`.

## Local Database

Use an isolated local PostgreSQL instance for launch smoke:

```bash
docker rm -f vyrdx-launch-postgres 2>/dev/null || true
docker run -d --name vyrdx-launch-postgres \
  -e POSTGRES_USER=vyrdx \
  -e POSTGRES_PASSWORD='<local-password>' \
  -e POSTGRES_DB=vyrdx_launch \
  -p 127.0.0.1:55432:5432 \
  postgres:17-alpine
until docker exec vyrdx-launch-postgres pg_isready -U vyrdx -d vyrdx_launch; do sleep 1; done
DATABASE_URL='postgresql://vyrdx:<local-password>@127.0.0.1:55432/vyrdx_launch' scripts/launch/smoke
```

`scripts/launch/smoke` applies the runtime schema (`migrateSchema` plus `ensureSchemaVersion`) before it writes the payment request. A payment success claim is valid only when the route returns `200` or `201` and the launch room contains `payment_requested` plus `payment_created`.

## Production Database

Docker Compose now passes the runtime variable the Node process reads:

```bash
POSTGRES_PASSWORD='<prod-password>' docker compose -f deploy/docker-compose.yml up -d postgres vxstation
curl -s http://127.0.0.1:7800/api/vyrdx/launch/runtime-config
```

For non-Compose production, set:

```bash
export DATABASE_URL='postgresql://vyrdon:<prod-password>@<postgres-host>:5432/vyrdon'
```

## Smoke Flow

`scripts/launch/smoke` proves this path without external CRM secrets:

1. Intake case is evaluated by the VYRDX gate law.
2. IQ200 packet reaches pass state.
3. Q201 reaches CRM and payment-ready states.
4. CRM route is gated and either succeeds through a configured dispatcher or fails closed with `INCOMPLETE_INTEGRATION_CONFIG`.
5. Payment request route is gated, writes to PostgreSQL, and emits `payment_requested` plus `payment_created`.
6. Flyer feedback is ingested and routed to `launch-feedback`.
7. Launch monitor room JSON is returned with counts, last events, blocked reasons, and evidence stamps.

The smoke output includes:

- `commit`
- `evidenceLog`
- `steps.intake`
- `steps.crm`
- `steps.payment`
- `steps.feedback`
- `rooms.launchRuntime`
- `rooms.launchRevenue`
- `rooms.launchFeedback`

## Production Stop Conditions

Halt immediately on:

- `evidence_not_written`
- any returned success without an evidence stamp
- any business motion bypassing IQ200/Q201
- monitor rooms missing transition events
- flyer send without consent, dedupe, throttle, and opt-out handling
- any secret printed in logs or output

## Monitor Rooms

Use the JSON room endpoints:

```bash
curl -s http://127.0.0.1:7800/api/vyrdx/launch/rooms/launch-runtime
curl -s http://127.0.0.1:7800/api/vyrdx/launch/rooms/launch-revenue
curl -s http://127.0.0.1:7800/api/vyrdx/launch/rooms/launch-feedback
```

Use the HTML room views:

```bash
curl -s http://127.0.0.1:7800/vyrdx/launch/launch-runtime
curl -s http://127.0.0.1:7800/vyrdx/launch/launch-revenue
curl -s http://127.0.0.1:7800/vyrdx/launch/launch-feedback
```
