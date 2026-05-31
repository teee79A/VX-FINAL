KITTY IS CLOSED AS RUNTIME.

- KITTY = build + packaging only
- DROPLET = runtime artifact host

No production service may execute source directly from KITTY.
No production deploy may rsync the live working tree into place.
No production service may use `tsx` against source files.

Deployment law:

- build locally
- stage artifact
- deploy to `/opt/vxstation/releases/<release>/app`
- switch `/opt/vxstation/current`
- run production from `/opt/vxstation/current/app/dist`

Current repository reality:

- this repo does not currently contain the `/rooms/*` frontend stack requested for public room pages
- closure work therefore applies to deployment/runtime boundaries first
- missing room routes are a product/runtime gap, not a deploy-script-only issue
