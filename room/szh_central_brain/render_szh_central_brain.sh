#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/szh_central_brain"
# shellcheck source=/dev/null
source "$ROOT/szh_common.sh"

print_header "SZH_CENTRAL_BRAIN / TV OVERVIEW"

printf 'ROOM STRUCTURE\n'
list_sections

printf '\nORCHESTRATION DOMAINS\n'
list_orchestration_domains

printf '\nENGINE STATUS\n'
print_engine_matrix

printf '\nCONNECTOR REGISTRY\n'
print_tsv "$ROOM_ROOT/connector_registry.tsv"

printf '\nSERVER ENDPOINTS\n'
print_endpoint_matrix

printf '\nGATEWAY GUARDRAILS\n'
print_gateway_guardrail
