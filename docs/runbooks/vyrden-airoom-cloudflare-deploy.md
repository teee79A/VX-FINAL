# VYRDEN AI Room Deploy Runbook (`vyrden.com`)

This runbook wires the standalone AI room runtime on the droplet and exposes it through Cloudflare Tunnel.

## 1) Prepare local config

```bash
cd /opt/kitty
cp deploy/.env.vyrden.example deploy/.env.vyrden
cp vyrden-airoom/.env.template vyrden-airoom/.env.production
```

Set real values in `deploy/.env.vyrden` and `vyrden-airoom/.env.production`:
- Required security: `AIROOM_SECRET`, `VYRDEN_PASSKEY`
- Required inference for live responses: `CF_ACCOUNT_ID` + `CF_API_TOKEN` (or `OPENROUTER_API_KEY`, `MINIMAX_*`, `OLLAMA_HOST`)
- Optional Access headers: `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`

## 2) Deploy AI room service

```bash
chmod +x deploy/deploy-vyrden-airoom.sh
deploy/deploy-vyrden-airoom.sh --force
```

The script:
- Builds `vyrden-airoom`
- Syncs artifact to `/opt/vyrden-airoom/releases/<release>/`
- Writes runtime env to `/opt/vyrden-airoom/current/app/vyrden-airoom/.env`
- Installs/restarts `vyrden-airoom.service`
- Verifies health, agent/engine counts, and live chat provider status

## 3) Install tunnel wiring on droplet

```bash
scp deploy/cloudflare-tunnel-vyrden.yml root@<droplet-ip>:/etc/cloudflared/vyrden-airoom.yml
scp deploy/vyrden-airoom-tunnel.service root@<droplet-ip>:/etc/systemd/system/vyrden-airoom-tunnel.service
ssh root@<droplet-ip>
cloudflared tunnel login
cloudflared tunnel create vyrden-airoom
cloudflared tunnel route dns vyrden-airoom vyrden.com
cloudflared tunnel route dns vyrden-airoom api.vyrden.com
cloudflared tunnel route dns --overwrite-dns vyrden-airoom vyrden-api.vyrdon.com
systemctl daemon-reload
systemctl enable --now vyrden-airoom-tunnel
```

Place tunnel credentials JSON at:
- `/etc/cloudflared/vyrden-airoom-creds.json`

## 4) Verify end-to-end

```bash
curl -sf https://vyrden.com/health
curl -sf https://vyrden.com/api/status
curl -sf https://vyrden.com/api/inference
```

Expected:
- `engineCount >= 98`
- `activeAgents >= 7`
- `activeProvider != "none"` for live model responses

If `vyrden.com` is in a different Cloudflare account/zone and `route dns` fails, keep using `https://vyrden-api.vyrdon.com` as the API/WebSocket origin until zone ownership is unified.
