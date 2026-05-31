#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/commercial_room"
# shellcheck source=/dev/null
source "$ROOT/commercial_common.sh"

print_header "COMMERCIAL_ROOM / OPERATOR ACTIONS"

printf 'ROOM CONTROL\n'
printf '  %s\n' "/home/t79/KITTY/bin/kitty-commercial-room.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/commercial-room-report.sh"

printf '\nENGINE START COMMANDS\n'
printf '  %-20s %s\n' "n8n" "$HOME/.npm-global/bin/n8n start"
printf '  %-20s %s\n' "temporal" "temporal server start-dev --ip 127.0.0.1"
printf '  %-20s %s\n' "airflow" "airflow standalone"
printf '  %-20s %s\n' "kafka" "$HOME/.local/opt/kafka/bin/kafka-server-start.sh $HOME/.local/opt/kafka/config/kraft/server.properties"
printf '  %-20s %s\n' "qdrant" "docker run -d --name qdrant -p 6333:6333 qdrant/qdrant"
printf '  %-20s %s\n' "consul" "consul agent -dev -client=127.0.0.1"
printf '  %-20s %s\n' "boundary" "boundary dev"

printf '\nENGINE STOP COMMANDS\n'
printf '  %-20s %s\n' "n8n" "pkill -f 'n8n'"
printf '  %-20s %s\n' "temporal" "pkill -f 'temporal.*start-dev'"
printf '  %-20s %s\n' "airflow" "pkill -f 'airflow'"
printf '  %-20s %s\n' "kafka" "pkill -f 'kafka.Kafka'"
printf '  %-20s %s\n' "qdrant" "docker stop qdrant && docker rm qdrant"
printf '  %-20s %s\n' "consul" "pkill -f 'consul agent'"
printf '  %-20s %s\n' "boundary" "pkill -f 'boundary dev'"
