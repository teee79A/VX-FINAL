#!/usr/bin/env bash

resolve_terminal_binary() {
  local name="$1"
  local fallback="${2:-}"

  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi

  if [[ -n "$fallback" && -x "$fallback" ]]; then
    printf '%s\n' "$fallback"
    return 0
  fi

  return 1
}

launch_terminal_layout() {
  local session="$1"
  local layout="$2"
  local title="$3"
  local zellij_bin
  local kitty_bin=""
  local log_dir="$HOME/.cache/vxstation"
  local log_file=""

  zellij_bin="$(resolve_terminal_binary zellij /home/t79/generic/.local/bin/zellij)" || {
    echo "missing zellij binary" >&2
    return 1
  }

  kitty_bin="$(resolve_terminal_binary kitty /home/t79/generic/.local/kitty.app/bin/kitty || true)"

  if [[ -n "${KITTY_WINDOW_ID:-}" ]]; then
    exec "$zellij_bin" --session "$session" --new-session-with-layout "$layout"
  fi

  if [[ -n "$kitty_bin" && ( -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" ) ]]; then
    mkdir -p "$log_dir"
    log_file="$log_dir/${session}.launch.log"

    # Check if session already exists — attach instead of creating new
    local zellij_cmd="--session $session --new-session-with-layout $layout"
    if "$zellij_bin" list-sessions 2>/dev/null | grep -q "^${session} "; then
      zellij_cmd="attach $session"
    fi

    # setsid detaches from parent process group so windows survive shell exit
    setsid "$kitty_bin" \
      --title "$title" \
      "$zellij_bin" \
      $zellij_cmd \
      >"$log_file" 2>&1 </dev/null &
    disown 2>/dev/null || true
    for _ in $(seq 1 25); do
      if pgrep -fa "zellij --server .*${session}" >/dev/null 2>&1; then
        echo "launched $session via kitty"
        return 0
      fi
      sleep 0.2
    done

    echo "failed to confirm zellij session: $session" >&2
    [[ -f "$log_file" ]] && tail -n 40 "$log_file" >&2 || true
    return 1
  fi

  if [[ -t 0 && -t 1 ]]; then
    exec "$zellij_bin" --session "$session" --new-session-with-layout "$layout"
  fi

  echo "no interactive terminal available for $session" >&2
  return 1
}
