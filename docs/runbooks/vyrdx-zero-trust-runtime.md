# VYRDx Zero Trust Runtime Guard

## Purpose

Keep mutation surfaces fail-closed and drift-proof in cloud runtime.

Guarded paths are enforced in [`server/security/zero-trust.ts`](/opt/kitty/server/security/zero-trust.ts).

## Required deploy env (cloud)

- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

These values must be a valid Cloudflare Access service token pair for `vyrdx.vyrdon.com`.

## Runtime behavior

- Cloud mode + guarded mutation route + missing token config:
  - returns `503 zero_trust_not_configured`
- Cloud mode + guarded mutation route + invalid token headers:
  - returns `403 zero_trust_denied`
- Local mode:
  - guard is bypassed for development

## No-drift controls

- Deploy verification now fails unless guarded mutation probe returns `403` or `503`.
- Stop-conditions include `zero_trust_not_configured` in `primary_db` cloud mode when token pair is missing.
- Unit tests lock route guard contract in [`tests/zero-trust-guard.test.ts`](/opt/kitty/tests/zero-trust-guard.test.ts).

## Smoke checks

```bash
curl -sS https://vyrdx.vyrdon.com/api/build

curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST https://vyrdx.vyrdon.com/api/conductor/fire/layer \
  -H 'content-type: application/json' \
  --data '{}'

curl -sS https://vyrdx.vyrdon.com/api/room-contract/stop-conditions
```

