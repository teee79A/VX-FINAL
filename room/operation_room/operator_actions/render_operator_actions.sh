#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/operation_room"
# shellcheck source=/dev/null
source "$ROOT/operation_common.sh"

print_header "OPERATION_ROOM / OPERATOR ACTIONS"

printf 'ROOM CONTROL\n'
printf '  %s\n' "/home/t79/KITTY/bin/kitty-operation-room.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/operation-room-report.sh"

printf '\nENGINE START COMMANDS\n'
printf '  %-20s %s\n' "n8n" "n8n start --host 127.0.0.1 --port 5678"
printf '  %-20s %s\n' "temporal" "temporal server start-dev --ip 127.0.0.1"
printf '  %-20s %s\n' "airflow" "airflow standalone"
printf '  %-20s %s\n' "agentgateway" "python3 /home/t79/KITTY/bin/agentgateway.py"
printf '  %-20s %s\n' "mcp-time-calendar" "python3 /home/t79/KITTY/bin/mcp-time-calendar-agent.py"
printf '  %-20s %s\n' "mcp-voice-agent" "python3 /home/t79/KITTY/bin/mcp-voice-agent.py"

printf '\nENGINE STOP COMMANDS\n'
printf '  %-20s %s\n' "n8n" "pkill -f 'n8n'"
printf '  %-20s %s\n' "temporal" "pkill -f 'temporal.*start-dev'"
printf '  %-20s %s\n' "airflow" "pkill -f 'airflow'"
printf '  %-20s %s\n' "agentgateway" "pkill -f 'agentgateway.py'"
printf '  %-20s %s\n' "mcp-time-calendar" "pkill -f 'mcp-time-calendar-agent.py'"
printf '  %-20s %s\n' "mcp-voice-agent" "pkill -f 'mcp-voice-agent.py'"

printf '\nMEDIA TEST COMMANDS\n'
printf '  %-20s %s\n' "video test" "ffplay /path/to/video.mp4"
printf '  %-20s %s\n' "audio capture" "arecord -d 5 /tmp/test.wav"
printf '  %-20s %s\n' "audio playback" "aplay /tmp/test.wav"
