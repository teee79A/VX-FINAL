# VXSTATION ZSH Automation Hub
# Source from Oh My Zsh custom plugins or directly from .zshrc

export VXSTATION_ROOT="/home/t79/KITTY"
export VXSTATION_VENV="${VXSTATION_ROOT}/.venv"
export VXSTATION_PYTHON="${VXSTATION_VENV}/bin/python3"
export VXSTATION_NODE="/usr/bin/node"
export VXSTATION_NPM="/usr/bin/npm"

alias vxhub='/home/t79/KITTY/bin/zsh-automation-hub.sh'
alias vx-sales='/home/t79/KITTY/bin/zsh-automation-hub.sh sales-cycle'
alias vx-fulfill='/home/t79/KITTY/bin/zsh-automation-hub.sh fulfillment'
alias vx-handoff='/home/t79/KITTY/bin/zsh-automation-hub.sh handoff'
alias vx-ops='/home/t79/KITTY/bin/ops-brain.sh'
alias vx-ops-list='/home/t79/KITTY/bin/ops-brain.sh list'
alias vx-brain-report='/home/t79/KITTY/bin/central-brain-report.sh'
alias vx-room-report-op='/home/t79/KITTY/bin/operation-room-report.sh'
alias vx-room-report-commercial='/home/t79/KITTY/bin/commercial-room-report.sh'
alias vx-room-report-archive='/home/t79/KITTY/bin/archive-room-report.sh'
alias vx-room-report-feedback='/home/t79/KITTY/bin/feedback-cloud-room-report.sh'
alias vx-media-audio='bash /home/t79/KITTY/room/operation_room/media_audio/render_media_audio.sh'
alias vx-media-video='bash /home/t79/KITTY/room/operation_room/media_video/render_media_video.sh'
alias vx-n8n-up='/home/t79/KITTY/bin/n8n-up.sh'
alias vx-n8n-down='/home/t79/KITTY/bin/n8n-down.sh'
alias vx-mcp-selftest='/home/t79/KITTY/bin/vxstation-mcp-selftest.sh'
_vxstation_prepend_path() {
  if [ -n "${1:-}" ] && [ -d "$1" ]; then
    case ":${PATH}:" in
      *":$1:"*) ;;
      *) PATH="$1:${PATH}" ;;
    esac
  fi
}

_vxstation_brain_env() {
  export VIRTUAL_ENV="${VXSTATION_VENV}"
  _vxstation_prepend_path "${VXSTATION_VENV}/bin"
  _vxstation_prepend_path "${VXSTATION_ROOT}/node_modules/.bin"
  _vxstation_prepend_path "${HOME}/.npm-global/bin"
  _vxstation_prepend_path "${HOME}/.local/bin"
  _vxstation_prepend_path "/usr/local/bin"
  export PATH
}

vx-brain-python() {
  _vxstation_brain_env
  "${VXSTATION_PYTHON}" "$@"
}

vx-brain-stack() {
  _vxstation_brain_env
  "${VXSTATION_PYTHON}" "${VXSTATION_ROOT}/bin/vxstation-brain-stack.py" "$@"
}

vx-brains() {
  vxctl brain status "$@"
}

vx-codeinterpreter() {
  _vxstation_brain_env
  "${VXSTATION_PYTHON}" "${VXSTATION_ROOT}/bin/vxstation-codeinterpreter.py" "$@"
}

vxctl() {
  _vxstation_brain_env
  "${VXSTATION_PYTHON}" "${VXSTATION_ROOT}/bin/vxstation_cli.py" "$@"
}

vx-station-map() {
  vxctl station map
}

vx-seal() {
  _vxstation_brain_env
  "${VXSTATION_PYTHON}" "${VXSTATION_ROOT}/bin/vxstation-seal.py" "$@"
}

vx-mcp-server() {
  _vxstation_brain_env
  "${VXSTATION_PYTHON}" "${VXSTATION_ROOT}/bin/vxstation-mcp-server.py" "$@"
}

vx-agentgateway() {
  vxctl gateway "$@"
}

_vxstation_gateway_ready() {
  curl -fsS --max-time 2 http://127.0.0.1:46080/health >/dev/null 2>&1
}

_vxstation_gateway_dispatch() {
  local command_id="${1:?command_id required}"
  local params_json="${2:-{}}"
  local caller="${3:-OperatorLocal}"
  vxctl gateway dispatch "$command_id" --params "$params_json" --caller "$caller"
}

vx-brain() {
  vxctl room open brain
}

vx-brain-local() {
  vxctl room open brain "$@"
}

vx-brain-reset() {
  vx-brain "$@"
}

vx-tv() {
  vxctl stack tv
}

vx-tv-local() {
  vxctl stack tv "$@"
}

vx-tv-reset() {
  vxctl stack tv --reset
}

vx-dashboard() {
  vxctl dashboard tv "$@"
}

vx-room-op() {
  vxctl room open operation
}

vx-room-op-local() {
  vxctl room open operation "$@"
}

vx-room-commercial() {
  vxctl room open commercial
}

vx-room-commercial-local() {
  vxctl room open commercial "$@"
}

vx-room-archive() {
  vxctl room open archive
}

vx-room-archive-local() {
  vxctl room open archive "$@"
}

vx-room-feedback() {
  vxctl room open feedback
}

vx-room-feedback-local() {
  vxctl room open feedback "$@"
}

vx-radar() {
  vxctl room open radar "$@"
}

vx-room-radar-local() {
  vxctl room open radar "$@"
}

vx-media() {
  vx-room-op "$@"
}

vx-canvas() {
  _vxstation_brain_env
  TERM="${TERM:-xterm-256color}" notcurses-info "$@"
}

vx-stream() {
  _vxstation_brain_env
  mediamtx "$@"
}

vx-monitor() {
  _vxstation_brain_env
  zenith "$@"
}

vx-steampipe() {
  _vxstation_brain_env
  steampipe "$@"
}

vx-octosql() {
  _vxstation_brain_env
  octosql "$@"
}

vx-temporal() {
  _vxstation_brain_env
  temporal "$@"
}

vx-tenderly() {
  _vxstation_brain_env
  tenderly "$@"
}

vx-kitty-up() {
  vxctl stack up
}

vx-kitty-up-local() {
  vxctl stack up "$@"
}

vx-kitty-status() {
  vxctl stack status
}

vx-kitty-status-local() {
  vxctl stack status "$@"
}

vx-kitty-down() {
  vxctl stack down
}

vx-kitty-down-local() {
  vxctl stack down "$@"
}

vx-mcp-linux-admin-up() {
  vxctl mcp run linux up
}

vx-mcp-linux-admin-up-local() {
  vxctl mcp run linux up "$@"
}

vx-mcp-linux-admin-down() {
  vxctl mcp run linux down
}

vx-mcp-linux-admin-down-local() {
  vxctl mcp run linux down "$@"
}

vx-mcp-linux-admin-status() {
  vxctl mcp run linux status
}

vx-mcp-linux-admin-status-local() {
  vxctl mcp run linux status "$@"
}

vx-time-up() {
  vxctl mcp run time up
}

vx-time-up-local() {
  vxctl mcp run time up "$@"
}

vx-time-down() {
  vxctl mcp run time down
}

vx-time-down-local() {
  vxctl mcp run time down "$@"
}

vx-time-status() {
  vxctl mcp run time status
}

vx-time-status-local() {
  vxctl mcp run time status "$@"
}

vx-voice-up() {
  vxctl mcp run voice up
}

vx-voice-up-local() {
  vxctl mcp run voice up "$@"
}

vx-voice-down() {
  vxctl mcp run voice down
}

vx-voice-down-local() {
  vxctl mcp run voice down "$@"
}

vx-voice-status() {
  vxctl mcp run voice status
}

vx-voice-status-local() {
  vxctl mcp run voice status "$@"
}

vx-agentgateway-up() {
  vxctl gateway up "$@"
}

vx-agentgateway-down() {
  vxctl gateway down "$@"
}

vx-agentgateway-status() {
  vxctl gateway status "$@"
}

vx-node() {
  _vxstation_brain_env
  "${VXSTATION_NODE}" "$@"
}

vx-npm() {
  _vxstation_brain_env
  "${VXSTATION_NPM}" "$@"
}

vx-mcp-ssh() {
  _vxstation_brain_env
  "${VXSTATION_ROOT}/node_modules/.bin/mcp-ssh" "$@"
}

vx-openai() {
  _vxstation_brain_env
  openai "$@"
}

vx-mcp() {
  _vxstation_brain_env
  mcp "$@"
}

vx-brain-install-check() {
  _vxstation_brain_env
  "${VXSTATION_PYTHON}" "${VXSTATION_ROOT}/bin/vxstation-brain-stack.py" --check
}

# NEURE Central Brain UI
alias brain-on='neure dash --view industrial \
  --ops-ceo="terminal-yos" \
  --fin-ceo="central-accounting" \
  --durability="temporal"'
alias work-start='neure trigger mission-01 --auto-stamp'
