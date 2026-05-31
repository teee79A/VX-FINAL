#!/usr/bin/env bash
set -euo pipefail

# VYRDEN AI Room deploy script
# Artifact-based release flow for the standalone vyrden.com runtime.
# Usage:
#   ./deploy-vyrden-airoom.sh [--setup | --build | --sync | --install | --restart | --status | --logs | --verify | --rollback | --force | all]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

if [[ -f "$SCRIPT_DIR/.env.vyrden" ]]; then
  set -a
  source "$SCRIPT_DIR/.env.vyrden"
  set +a
fi

DO_DROPLET_IP="${DO_DROPLET_IP:?DO_DROPLET_IP must be set}"
DO_SSH_KEY="${DO_SSH_KEY:-$HOME/.ssh/id_deploy_vyrdon}"

REMOTE_PATH="/opt/vyrden-airoom"
REMOTE_RELEASES="${REMOTE_PATH}/releases"
REMOTE_SHARED="${REMOTE_PATH}/shared"
REMOTE_CURRENT="${REMOTE_PATH}/current"

AIROOM_LOCAL_ROOT="${REPO_ROOT}/vyrden-airoom"
AIROOM_ENV_FILE="${AIROOM_ENV_FILE:-}"
LOCAL_ARTIFACT_DIR="${REPO_ROOT}/.build/vyrden-airoom"
REQUIRE_LIVE_INFERENCE="${REQUIRE_LIVE_INFERENCE:-1}"

SSH_CMD="ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i ${DO_SSH_KEY}"

log() { echo "[vyrden-deploy] $(date +%H:%M:%S) $*"; }
die() { echo "[vyrden-deploy] ERROR: $*" >&2; exit 1; }
remote() { $SSH_CMD "root@${DO_DROPLET_IP}" "$@"; }

require_clean_git() {
  local dirty
  dirty=$(cd "$REPO_ROOT" && git status --porcelain -- . ':!deploy/.env' ':!deploy/.env.vyrden' ':!vyrden-airoom/.env' ':!vyrden-airoom/.env.production' 2>/dev/null | grep -v '^\?\?' || true)
  if [[ -n "$dirty" ]]; then
    echo "$dirty"
    die "Working tree is dirty. Commit or stash changes before deploying."
  fi
  log "Git tree is clean."
}

build_local() {
  cd "$AIROOM_LOCAL_ROOT"

  if [[ ! -d node_modules ]]; then
    log "Installing local AI room dependencies..."
    npm ci
  fi

  log "Type checking AI room..."
  npm run typecheck

  log "Building AI room..."
  npm run build

  log "AI room build complete."
}

prepare_artifact() {
  log "Preparing AI room artifact..."
  rm -rf "${LOCAL_ARTIFACT_DIR}"
  mkdir -p "${LOCAL_ARTIFACT_DIR}/app/vyrden-airoom"

  rsync -a --delete "${AIROOM_LOCAL_ROOT}/dist/" "${LOCAL_ARTIFACT_DIR}/app/vyrden-airoom/dist/"

  cp "${AIROOM_LOCAL_ROOT}/package.json" "${LOCAL_ARTIFACT_DIR}/app/vyrden-airoom/"
  cp "${AIROOM_LOCAL_ROOT}/package-lock.json" "${LOCAL_ARTIFACT_DIR}/app/vyrden-airoom/" 2>/dev/null || true
  cp "${AIROOM_LOCAL_ROOT}/.env.template" "${LOCAL_ARTIFACT_DIR}/app/vyrden-airoom/.env.template"
  cp "${AIROOM_LOCAL_ROOT}/server.js" "${LOCAL_ARTIFACT_DIR}/app/vyrden-airoom/server.js"
  cp -r "${REPO_ROOT}/deploy" "${LOCAL_ARTIFACT_DIR}/app/deploy"

  log "Artifact prepared -> ${LOCAL_ARTIFACT_DIR}/app"
}

get_build_metadata() {
  cd "$REPO_ROOT"
  GIT_COMMIT="$(git rev-parse HEAD)"
  GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  GIT_SHORT="$(git rev-parse --short HEAD)"
  BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  RELEASE_ID="$(date -u +"%Y%m%dT%H%M%SZ")-${GIT_SHORT}"
  log "Commit: ${GIT_SHORT} (${GIT_BRANCH}) @ ${BUILD_TIME}"
  log "Release: ${RELEASE_ID}"
}

prepare_remote_layout() {
  log "Preparing remote AI room layout..."
  remote "mkdir -p \
    ${REMOTE_RELEASES} \
    ${REMOTE_SHARED}/logs \
    ${REMOTE_SHARED}/.vyrdon-memory \
    ${REMOTE_SHARED}/vyrden-airoom/agents \
    ${REMOTE_SHARED}/vyrden-airoom/evidence/requests \
    ${REMOTE_SHARED}/vyrden-airoom/evidence/agents \
    ${REMOTE_SHARED}/vyrden-airoom/evidence/audit"

  remote "if [[ -f ${REMOTE_CURRENT}/app/vyrden-airoom/.env && ! -f ${REMOTE_SHARED}/deploy.env ]]; then cp ${REMOTE_CURRENT}/app/vyrden-airoom/.env ${REMOTE_SHARED}/deploy.env; fi"
  remote "if [[ ! -f ${REMOTE_SHARED}/deploy.env && -f /opt/vxstation/vyrden-airoom/.env ]]; then cp /opt/vxstation/vyrden-airoom/.env ${REMOTE_SHARED}/deploy.env; fi"
  remote "if [[ -d /opt/vxstation/vyrden-airoom/.vyrdon-memory ]]; then cp -an /opt/vxstation/vyrden-airoom/.vyrdon-memory/. ${REMOTE_SHARED}/.vyrdon-memory/ 2>/dev/null || true; fi"
  remote "if [[ -d /opt/vxstation/vyrden-airoom/agents ]]; then cp -an /opt/vxstation/vyrden-airoom/agents/. ${REMOTE_SHARED}/vyrden-airoom/agents/ 2>/dev/null || true; fi"
  remote "if [[ -d /opt/vxstation/vyrden-airoom/evidence ]]; then cp -an /opt/vxstation/vyrden-airoom/evidence/. ${REMOTE_SHARED}/vyrden-airoom/evidence/ 2>/dev/null || true; fi"

  if [[ -n "$AIROOM_ENV_FILE" && -f "$AIROOM_ENV_FILE" ]]; then
    log "Syncing AI room env file to remote shared path..."
    rsync -az -e "$SSH_CMD" "$AIROOM_ENV_FILE" "root@${DO_DROPLET_IP}:${REMOTE_SHARED}/deploy.env"
  else
    if [[ -n "$AIROOM_ENV_FILE" ]]; then
      log "Local env file not found at ${AIROOM_ENV_FILE}; keeping remote shared env as-is."
    else
      log "AIROOM_ENV_FILE not set; keeping remote shared env as-is."
    fi
  fi

  remote "[[ -f ${REMOTE_SHARED}/deploy.env ]]" || die "Remote env missing: ${REMOTE_SHARED}/deploy.env (set AIROOM_ENV_FILE to upload one)"
  log "Remote layout ready."
}

sync_source() {
  log "Syncing artifact to ${DO_DROPLET_IP}:${REMOTE_RELEASES}/${RELEASE_ID}..."
  remote "mkdir -p ${REMOTE_RELEASES}/${RELEASE_ID}"
  rsync -az --delete -e "$SSH_CMD" "${LOCAL_ARTIFACT_DIR}/" "root@${DO_DROPLET_IP}:${REMOTE_RELEASES}/${RELEASE_ID}/"
  log "Sync complete."
}

install_deps() {
  log "Installing production dependencies in release ${RELEASE_ID}..."
  remote "cd ${REMOTE_RELEASES}/${RELEASE_ID}/app/vyrden-airoom && npm ci --omit=dev 2>&1 | tail -5"
  log "Dependencies installed."
}

inject_metadata_remote() {
  log "Writing release env..."
  remote "mkdir -p ${REMOTE_RELEASES}/${RELEASE_ID}/app/vyrden-airoom"
  remote "cp ${REMOTE_SHARED}/deploy.env ${REMOTE_RELEASES}/${RELEASE_ID}/app/vyrden-airoom/.env"
  remote "touch ${REMOTE_RELEASES}/${RELEASE_ID}/app/vyrden-airoom/.env && \
    sed -i '/^GIT_COMMIT=/d; /^GIT_BRANCH=/d; /^BUILD_TIME=/d; /^KITTY_ROOT=/d; /^MEMORY_DIR=/d; /^AIROOM_ENV=/d' ${REMOTE_RELEASES}/${RELEASE_ID}/app/vyrden-airoom/.env && \
    cat >> ${REMOTE_RELEASES}/${RELEASE_ID}/app/vyrden-airoom/.env <<'EOF'
GIT_COMMIT=${GIT_COMMIT}
GIT_BRANCH=${GIT_BRANCH}
BUILD_TIME=${BUILD_TIME}
KITTY_ROOT=${REMOTE_SHARED}
MEMORY_DIR=${REMOTE_SHARED}/.vyrdon-memory
AIROOM_ENV=production
EOF"
  remote "cp ${REMOTE_RELEASES}/${RELEASE_ID}/app/vyrden-airoom/.env ${REMOTE_SHARED}/deploy.env"
  log "Release env written."
}

install_service() {
  log "Installing vyrden-airoom systemd service..."
  remote "cp ${REMOTE_RELEASES}/${RELEASE_ID}/app/deploy/vyrden-airoom.service /etc/systemd/system/vyrden-airoom.service"
  remote "systemctl daemon-reload && systemctl enable vyrden-airoom"
  log "Service installed."
}

activate_release() {
  log "Activating release ${RELEASE_ID}..."
  remote "ln -sfn ${REMOTE_RELEASES}/${RELEASE_ID} ${REMOTE_CURRENT}"
  log "Release active."
}

start_service() {
  log "Restarting vyrden-airoom..."
  remote "systemctl restart vyrden-airoom"
  sleep 3
  remote "systemctl is-active vyrden-airoom" >/dev/null || die "vyrden-airoom did not become active"
  log "Service restarted."
}

resolve_remote_port() {
  remote "bash -lc 'port=3100; if [[ -f ${REMOTE_CURRENT}/app/vyrden-airoom/.env ]]; then found=\$(grep -E \"^AIROOM_PORT=\" ${REMOTE_CURRENT}/app/vyrden-airoom/.env | tail -1 | cut -d= -f2); if [[ -n \"\$found\" ]]; then port=\$found; fi; fi; echo \$port'"
}

verify_deployment() {
  log "Verifying AI room deployment..."
  local port
  port="$(resolve_remote_port | tr -d '\r\n' || true)"
  [[ -n "$port" ]] || port="3100"
  log "Using remote AI room port: ${port}"

  remote "curl -sf http://127.0.0.1:${port}/health >/dev/null" || die "Health check failed"
  log "Health endpoint OK."

  local status_json
  status_json="$(remote "curl -sf http://127.0.0.1:${port}/api/status")" || die "Status endpoint failed"

  local engine_count
  engine_count="$(node -e 'const payload = JSON.parse(process.argv[1]); process.stdout.write(String(payload.engineCount ?? ""));' "$status_json")"
  local agent_count
  agent_count="$(node -e 'const payload = JSON.parse(process.argv[1]); process.stdout.write(String(payload.agentCount ?? ""));' "$status_json")"
  local active_agents
  active_agents="$(node -e 'const payload = JSON.parse(process.argv[1]); process.stdout.write(String(payload.activeAgents ?? ""));' "$status_json")"

  [[ "$engine_count" =~ ^[0-9]+$ ]] || die "Could not parse engineCount from /api/status"
  [[ "$agent_count" =~ ^[0-9]+$ ]] || die "Could not parse agentCount from /api/status"
  [[ "$active_agents" =~ ^[0-9]+$ ]] || die "Could not parse activeAgents from /api/status"

  if (( engine_count < 98 )); then
    die "Engine catalog too small (expected >=98, got ${engine_count})"
  fi
  if (( agent_count < 7 || active_agents < 7 )); then
    die "Agent activation incomplete (agentCount=${agent_count}, activeAgents=${active_agents})"
  fi
  log "Agent/engine capacity OK (engines=${engine_count}, activeAgents=${active_agents})."

  local inference_json
  inference_json="$(remote "curl -sf http://127.0.0.1:${port}/api/inference")" || die "Inference status endpoint failed"
  local active_provider
  active_provider="$(node -e 'const payload = JSON.parse(process.argv[1]); process.stdout.write(String(payload.activeProvider ?? "none"));' "$inference_json")"

  if [[ "$active_provider" == "none" ]]; then
    if [[ "$REQUIRE_LIVE_INFERENCE" == "1" ]]; then
      die "No live inference provider is active (activeProvider=none). Configure CF/MiniMax/Ollama/OpenRouter secrets."
    fi
    log "WARNING: No live inference provider active (activeProvider=none)."
  else
    log "Inference provider active: ${active_provider}"
  fi

  local login_json
  login_json="$(remote "curl -sf -X POST http://127.0.0.1:${port}/auth/login -H 'content-type: application/json' --data '{\"guest\":true}'")" || die "Guest login check failed"
  local session_id
  session_id="$(node -e 'const payload = JSON.parse(process.argv[1]); process.stdout.write(String(payload.sessionId ?? ""));' "$login_json")"
  local session_token
  session_token="$(node -e 'const payload = JSON.parse(process.argv[1]); process.stdout.write(String(payload.sessionToken ?? ""));' "$login_json")"
  [[ -n "$session_id" && -n "$session_token" ]] || die "Guest login did not return session credentials"

  local chat_json
  chat_json="$(remote "curl -sf -X POST http://127.0.0.1:${port}/api/chat \
    -H 'content-type: application/json' \
    -H 'x-session-id: ${session_id}' \
    -H 'x-session-token: ${session_token}' \
    --data '{\"prompt\":\"health ping\",\"maxTokens\":64}'")" || die "Chat endpoint check failed"
  local chat_model
  chat_model="$(node -e 'const payload = JSON.parse(process.argv[1]); process.stdout.write(String(payload.model ?? ""));' "$chat_json")"
  [[ -n "$chat_model" ]] || die "Chat response missing model field"

  if [[ "$chat_model" == "offline-fallback" ]]; then
    if [[ "$REQUIRE_LIVE_INFERENCE" == "1" ]]; then
      die "Chat endpoint returned offline-fallback. Live model wiring is not complete."
    fi
    log "WARNING: Chat endpoint returned offline-fallback."
  else
    log "Chat endpoint returned live model: ${chat_model}"
  fi

  log "Verification complete."
}

cleanup_releases() {
  log "Cleaning up old AI room releases (keeping last 5)..."
  remote "cd ${REMOTE_RELEASES} && ls -1dt */ | tail -n +6 | xargs rm -rf 2>/dev/null || true"
  log "Cleanup done."
}

show_status() {
  remote "echo '=== VYRDEN AI ROOM ===' && systemctl status vyrden-airoom --no-pager -l 2>&1 | head -20 && \
    printf '\n--- Current Release ---\n' && if [[ -L ${REMOTE_CURRENT} ]]; then readlink -f ${REMOTE_CURRENT}; else echo '(no release symlink)'; fi"
}

show_logs() {
  remote "journalctl -u vyrden-airoom --no-pager -n 80"
}

setup() {
  log "Running droplet-setup.sh remotely..."
  $SSH_CMD "root@${DO_DROPLET_IP}" < "$SCRIPT_DIR/droplet-setup.sh"
  remote "mkdir -p \
    ${REMOTE_RELEASES} \
    ${REMOTE_SHARED}/logs \
    ${REMOTE_SHARED}/.vyrdon-memory \
    ${REMOTE_SHARED}/vyrden-airoom/agents \
    ${REMOTE_SHARED}/vyrden-airoom/evidence/requests \
    ${REMOTE_SHARED}/vyrden-airoom/evidence/agents \
    ${REMOTE_SHARED}/vyrden-airoom/evidence/audit"
  log "Setup complete."
}

rollback() {
  die "Rollback not yet implemented. Use: git revert + full deploy"
}

full_deploy() {
  local force="${1:-}"
  if [[ "$force" != "--force" ]]; then
    require_clean_git
  else
    log "--force enabled: skipping clean git check."
  fi

  get_build_metadata
  build_local
  prepare_artifact
  prepare_remote_layout
  sync_source
  install_deps
  inject_metadata_remote
  activate_release
  install_service
  start_service
  verify_deployment
  cleanup_releases

  log "============================================================"
  log "DEPLOY COMPLETE"
  log "  Commit: ${GIT_SHORT} (${GIT_BRANCH})"
  log "  Release: ${RELEASE_ID}"
  log "  Time: ${BUILD_TIME}"
  log "  Target: ${DO_DROPLET_IP}:${REMOTE_CURRENT}"
  log "  Verify: curl https://vyrden.com/health"
  log "============================================================"
}

case "${1:-all}" in
  --setup)    setup ;;
  --build)    build_local ;;
  --sync)     require_clean_git; get_build_metadata; prepare_artifact; prepare_remote_layout; sync_source ;;
  --install)  install_deps ;;
  --restart)  start_service ;;
  --status)   show_status ;;
  --logs)     show_logs ;;
  --verify)   verify_deployment ;;
  --rollback) rollback ;;
  --force)    full_deploy "--force" ;;
  all)        full_deploy ;;
  *) die "Unknown flag: $1. Use --setup, --build, --sync, --install, --restart, --status, --logs, --verify, --rollback, --force, or no flag for full deploy." ;;
esac
