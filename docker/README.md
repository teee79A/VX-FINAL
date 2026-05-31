# Kitty Docker Lane: OpenHands + vLLM

This stack keeps Kitty as control surface and runs AI engines as Docker services.

## Current host check

- Docker daemon: available
- NVIDIA runtime: not detected in this host session
- GPU device reported by `lspci`: Intel Iris Xe

Because `vLLM` in this compose is GPU profile (`gpus: all`), run it only on a compatible GPU host.

## 1) Prepare env

```bash
cd /opt/kitty/docker
cp .env.example .env
```

Set secrets in `.env`:

- `HF_TOKEN` for gated Hugging Face models
- `VLLM_API_KEY` if you want API-key protection
- `OPENROUTER_API_KEY` for OpenHands model access (or keep it exported in shell)

## 2) Start OpenHands

```bash
docker-compose -f compose.yml up -d openhands
```

Open:

- `http://localhost:3000` (OpenHands UI)

## 3) Start vLLM (GPU hosts only)

```bash
docker-compose -f compose.yml up -d vllm
```

Health check:

```bash
curl http://localhost:8000/v1/models
```

## 4) Stop services

```bash
docker-compose -f compose.yml down
```

## Notes

- This lane does not alter Kitty law: modules still cannot execute direct runtime actions.
- vLLM is exposed as a service endpoint (`:8000`) and should be consumed through approved adapters/policies.

## One-click run (Desktop)

Launchers created in:

- `/home/t79/Desktop/VYRDON TEAM /KITTY_RUN.desktop`
- `/home/t79/Desktop/VYRDON TEAM /KITTY_STATUS.desktop`
- `/home/t79/Desktop/VYRDON TEAM /KITTY_STOP.desktop`

Backed by scripts:

- `/opt/kitty/bin/kitty-up.sh`
- `/opt/kitty/bin/kitty-status.sh`
- `/opt/kitty/bin/kitty-down.sh`
