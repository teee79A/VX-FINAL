#!/usr/bin/env bash
set -euo pipefail

# VXSTATION Deploy Script — deterministic, artifact-based deployment.
# Single Fastify process on :7800 behind Cloudflare tunnel.
# Usage: ./deploy.sh [--setup | --build | --sync | --restart | --status | --logs | --verify | --rollback | --force | all]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

DO_DROPLET_IP="${DO_DROPLET_IP:?DO_DROPLET_IP must be set}"
DO_SSH_KEY="${DO_SSH_KEY:-$HOME/.ssh/id_deploy_vyrdon}"
REMOTE_PATH="/opt/vxstation"
REMOTE_RELEASES="${REMOTE_PATH}/releases"
REMOTE_SHARED="${REMOTE_PATH}/shared"
REMOTE_CURRENT="${REMOTE_PATH}/current"
LOCAL_ARTIFACT_DIR="${REPO_ROOT}/.build/vxstation"
SSH_CMD="ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i ${DO_SSH_KEY}"

log() { echo "[deploy] $(date +%H:%M:%S) $*"; }
die() { echo "[deploy] ERROR: $*" >&2; exit 1; }
remote() { $SSH_CMD "root@${DO_DROPLET_IP}" "$@"; }

# ── GATE: require clean git ────────────────────────────────────────────────

require_clean_git() {
  local dirty
  dirty=$(cd "$REPO_ROOT" && git status --porcelain -- . ':!deploy/.env' 2>/dev/null | grep -v '^\?\?' || true)
  if [[ -n "$dirty" ]]; then
    echo "$dirty"
    die "Working tree is dirty. Commit or stash changes before deploying."
  fi
  log "Git tree is clean."
}

# ── BUILD ──────────────────────────────────────────────────────────────────

build_local() {
  cd "$REPO_ROOT"

  log "Type checking..."
  npx tsc --noEmit || die "Type check failed. Fix errors before deploying."

  log "Compiling TypeScript..."
  npx tsc || die "TypeScript compilation failed."

  log "Build complete → dist/"

  log "Building VYRDx frontend..."
  cd "${REPO_ROOT}/packages/vyrdx-app"
  npx vite build || die "VYRDx frontend build failed."
  cd "$REPO_ROOT"
  log "VYRDx frontend built."
}

prepare_artifact() {
  log "Preparing deployment artifact..."
  rm -rf "${LOCAL_ARTIFACT_DIR}"
  mkdir -p "${LOCAL_ARTIFACT_DIR}/app"

  rsync -a --delete "${REPO_ROOT}/dist/" "${LOCAL_ARTIFACT_DIR}/app/dist/"

  # Include VYRDx SPA static files
  if [[ -d "${REPO_ROOT}/packages/vyrdx-app/dist" ]]; then
    rsync -a --delete "${REPO_ROOT}/packages/vyrdx-app/dist/" "${LOCAL_ARTIFACT_DIR}/app/vyrdx-static/"
    log "VYRDx static assets included."
  fi

  cp "${REPO_ROOT}/package.json" "${LOCAL_ARTIFACT_DIR}/app/"
  cp "${REPO_ROOT}/package-lock.json" "${LOCAL_ARTIFACT_DIR}/app/" 2>/dev/null || true
  cp -r "${REPO_ROOT}/deploy" "${LOCAL_ARTIFACT_DIR}/app/deploy/"

  log "Artifact prepared → ${LOCAL_ARTIFACT_DIR}/app"
}

# ── METADATA ───────────────────────────────────────────────────────────────

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
  log "Preparing remote release layout..."
  remote "mkdir -p ${REMOTE_RELEASES} ${REMOTE_SHARED}/evidence/journal/command_backbone ${REMOTE_SHARED}/logs ${REMOTE_SHARED}/seals"
  remote "if [[ -f ${REMOTE_PATH}/deploy/.env && ! -f ${REMOTE_SHARED}/deploy.env ]]; then cp ${REMOTE_PATH}/deploy/.env ${REMOTE_SHARED}/deploy.env; fi"
  remote "if [[ -L ${REMOTE_CURRENT} && -f ${REMOTE_CURRENT}/app/deploy/.env && ! -f ${REMOTE_SHARED}/deploy.env ]]; then cp ${REMOTE_CURRENT}/app/deploy/.env ${REMOTE_SHARED}/deploy.env; fi"
  remote "if [[ -d ${REMOTE_PATH}/evidence/journal ]]; then cp -an ${REMOTE_PATH}/evidence/journal/. ${REMOTE_SHARED}/evidence/journal/ 2>/dev/null || true; fi"
  log "Remote layout ready."
}

inject_metadata_remote() {
  log "Writing release env..."
  remote "mkdir -p ${REMOTE_RELEASES}/${RELEASE_ID}/app/deploy"
  remote "if [[ -f ${REMOTE_SHARED}/deploy.env ]]; then cp ${REMOTE_SHARED}/deploy.env ${REMOTE_RELEASES}/${RELEASE_ID}/app/deploy/.env; fi"
  remote "touch ${REMOTE_RELEASES}/${RELEASE_ID}/app/deploy/.env && \
    sed -i '/^GIT_COMMIT=/d; /^GIT_BRANCH=/d; /^BUILD_TIME=/d; /^KITTY_ROOT=/d; /^KITTY_HASH_HEAD=/d; /^KITTY_COMMAND_AUDIT_FILE=/d; /^KITTY_COMMAND_BACKBONE_DIR=/d' ${REMOTE_RELEASES}/${RELEASE_ID}/app/deploy/.env && \
    cat >> ${REMOTE_RELEASES}/${RELEASE_ID}/app/deploy/.env <<'EOF'
GIT_COMMIT=${GIT_COMMIT}
GIT_BRANCH=${GIT_BRANCH}
BUILD_TIME=${BUILD_TIME}
KITTY_ROOT=${REMOTE_CURRENT}/app
KITTY_HASH_HEAD=${REMOTE_SHARED}/evidence/journal/command_bus.hash.head
KITTY_COMMAND_AUDIT_FILE=${REMOTE_SHARED}/evidence/journal/command_bus.audit.jsonl
KITTY_COMMAND_BACKBONE_DIR=${REMOTE_SHARED}/evidence/journal/command_backbone
EOF"
  remote "cp ${REMOTE_RELEASES}/${RELEASE_ID}/app/deploy/.env ${REMOTE_SHARED}/deploy.env"
  log "Release env written."
}

# ── SYNC ───────────────────────────────────────────────────────────────────

sync_source() {
  log "Syncing artifact to ${DO_DROPLET_IP}:${REMOTE_RELEASES}/${RELEASE_ID}..."
  remote "mkdir -p ${REMOTE_RELEASES}/${RELEASE_ID}"
  rsync -az --delete \
    -e "$SSH_CMD" \
    "${LOCAL_ARTIFACT_DIR}/" "root@${DO_DROPLET_IP}:${REMOTE_RELEASES}/${RELEASE_ID}/"
  log "Sync complete."
}

# ── DEPS ───────────────────────────────────────────────────────────────────

install_deps() {
  log "Installing production dependencies in release ${RELEASE_ID}..."
  remote "cd ${REMOTE_RELEASES}/${RELEASE_ID}/app && npm ci --omit=dev 2>&1 | tail -5"
  log "Dependencies installed."
}

# ── SERVICE ────────────────────────────────────────────────────────────────

install_service() {
  log "Installing vxstation systemd service..."
  remote "cp ${REMOTE_RELEASES}/${RELEASE_ID}/app/deploy/vxstation.service /etc/systemd/system/vxstation.service"
  remote "systemctl daemon-reload && systemctl enable vxstation"
  log "Service installed."
}

activate_release() {
  log "Activating release ${RELEASE_ID}..."
  remote "ln -sfn ${REMOTE_RELEASES}/${RELEASE_ID} ${REMOTE_CURRENT}"
  log "Release active."
}

start_service() {
  log "Restarting vxstation..."
  remote "systemctl restart vxstation"
  sleep 3
  remote "systemctl is-active vxstation"
  log "Service restarted."
}

# ── VERIFY ─────────────────────────────────────────────────────────────────

verify_deployment() {
  log "Verifying deployment..."

  local health
  health=$(remote "curl -sf http://127.0.0.1:7800/health | head -c 200" 2>/dev/null) || die "Health check failed"
  log "Health: OK"

  local build_info
  build_info=$(remote "curl -sf http://127.0.0.1:7800/build" 2>/dev/null) || die "Build metadata endpoint failed"
  log "Build info: ${build_info}"

  local zt_guard_status
  zt_guard_status=$(remote "curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:7800/api/conductor/fire/layer -H 'content-type: application/json' --data '{}'" 2>/dev/null) || zt_guard_status="000"
  if [[ "$zt_guard_status" == "403" || "$zt_guard_status" == "503" ]]; then
    log "✅ Zero Trust mutation guard active (${zt_guard_status})"
  else
    die "Zero Trust mutation guard failed (expected 403/503, got ${zt_guard_status})"
  fi

  local deployed_commit
  deployed_commit=$(echo "$build_info" | grep -o '"commit":"[^"]*"' | cut -d'"' -f4)
  if [[ "$deployed_commit" == "$GIT_COMMIT" ]]; then
    log "✅ Deployed commit matches: ${GIT_SHORT}"
  else
    log "⚠️  Commit mismatch — deployed: ${deployed_commit}, expected: ${GIT_COMMIT}"
  fi

  for room in commercial operations evidence camps policy; do
    local page
    page=$(remote "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:7800/rooms/${room}" 2>/dev/null) || true
    if [[ "$page" == "200" ]]; then
      log "✅ /rooms/${room} page loads"
    else
      log "⚠️  /rooms/${room} returned ${page:-no response}"
    fi
  done

  local landing
  landing=$(remote "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:7800/" 2>/dev/null) || true
  if [[ "$landing" == "200" ]]; then
    log "✅ Landing page loads"
  else
    log "⚠️  Landing page returned ${landing:-no response}"
  fi

  log "Verification complete."
}

# ── STATUS / LOGS ──────────────────────────────────────────────────────────

show_status() {
  remote "echo '=== VXSTATION ===' && systemctl status vxstation --no-pager -l 2>&1 | head -15 && \
    printf '\n--- Current Release ---\n' && readlink -f ${REMOTE_CURRENT}"
}

show_logs() {
  remote "journalctl -u vxstation --no-pager -n 50"
}

# ── SETUP ──────────────────────────────────────────────────────────────────

setup() {
  log "Running droplet-setup.sh remotely..."
  $SSH_CMD "root@${DO_DROPLET_IP}" < "$SCRIPT_DIR/droplet-setup.sh"
  log "Setup complete."
}

# ── ROLLBACK ───────────────────────────────────────────────────────────────

rollback() {
  die "Rollback not yet implemented. Use: git revert + full_deploy"
}

# ── CLEANUP OLD RELEASES ──────────────────────────────────────────────────

cleanup_releases() {
  log "Cleaning up old releases (keeping last 5)..."
  remote "cd ${REMOTE_RELEASES} && ls -1dt */ | tail -n +6 | xargs rm -rf 2>/dev/null || true"
  log "Cleanup done."
}

# ── FULL DEPLOY ────────────────────────────────────────────────────────────

full_deploy() {
  local force="${1:-}"

  if [[ "$force" != "--force" ]]; then
    require_clean_git
  else
    log "⚠️  --force: skipping clean git check"
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

  log "═══════════════════════════════════════════════════"
  log "✅ DEPLOY COMPLETE"
  log "   Commit: ${GIT_SHORT} (${GIT_BRANCH})"
  log "   Release: ${RELEASE_ID}"
  log "   Time:   ${BUILD_TIME}"
  log "   Target: ${DO_DROPLET_IP}:${REMOTE_CURRENT}"
  log "   Verify: curl https://vyrdx.vyrdon.com/api/build"
  log "═══════════════════════════════════════════════════"
}

# ── DISPATCH ───────────────────────────────────────────────────────────────

case "${1:-all}" in
  --setup)    setup ;;
  --build)    build_local ;;
  --sync)     require_clean_git; get_build_metadata; prepare_artifact; sync_source ;;
  --install)  install_deps ;;
  --restart)  start_service ;;
  --status)   show_status ;;
  --logs)     show_logs ;;
  --verify)   get_build_metadata; verify_deployment ;;
  --rollback) rollback ;;
  --force)    full_deploy "--force" ;;
  all)        full_deploy ;;
  *) die "Unknown flag: $1. Use --setup, --build, --sync, --install, --restart, --status, --logs, --verify, --rollback, --force, or no flag for full deploy." ;;
esac
