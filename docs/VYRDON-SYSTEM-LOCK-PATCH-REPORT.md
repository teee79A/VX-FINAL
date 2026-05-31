# VYRDON System Lock Patch Report

## Status
LOCAL LOCK CHECKPOINT GREEN.

## Passed tests
- server/vyrdx/tests/gate.test.ts
- server/vyrdx/tests/gate-api.test.ts
- server/vyrdx/tests/v1.test.ts
- tests/flyer-bot.test.ts
- tests/launch-smoke.test.ts

## Locked behavior
- Random evidence IDs fail.
- Loose legacy evidence IDs fail.
- VYRDX-style evidence IDs are required for gate evaluation.
- V1 gate fixture is standards-compliant.
- Certification remains review-gated.
- Flyer bot evidence writes pass.
- Feedback routes into launch-feedback.
- Booked event is counted.
- Launch evidence stamps use evd_launch_ prefix.

## Files intentionally changed
- server/vyrdx/domain/gate.ts
- server/vyrdx/domain/evidence-standard.mjs
- server/vyrdx/domain/launch-events.ts
- server/vyrdx-relay.ts
- server/vyrdx/api/bot-flyers.ts
- scripts/launch/smoke.ts
- server/vyrdx/tests/gate.test.ts
- server/vyrdx/tests/gate-api.test.ts
- server/vyrdx/tests/v1.test.ts
- tests/flyer-bot.test.ts
- tests/launch-smoke.test.ts

## Do not commit unless intentional
- .vscode/*
- evidence/journal/*
- built dist assets unless explicitly part of deploy artifact

## Remaining blockers
- Codex usage limit blocked automation.
- KITTYVXSTATION has disk capacity but not enough RAM for gpt-oss:latest execution.
- Full gateway/MCP/SZH unified path still needs audit.
