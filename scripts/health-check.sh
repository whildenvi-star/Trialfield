#!/usr/bin/env bash
#
# health-check.sh — Check all farm-ops app health endpoints
# Usage: bash scripts/health-check.sh
#

set -euo pipefail

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
BOLD="\033[1m"
RESET="\033[0m"

# Express apps with /health endpoints
declare -a APP_NAMES=("grain-tickets" "farm-budget" "fsa-acres" "meristem-malt" "farm-registry" "seed-inventory")
declare -a APP_PORTS=(3007 3001 3002 3003 3005 3006)

# Next.js apps (no /health, just TCP check)
declare -a NEXT_NAMES=("glomalin-portal" "organic-cert")
declare -a NEXT_PORTS=(3000 3004)

healthy=0
total=${#APP_NAMES[@]}

echo ""
echo -e "${BOLD}=== Express App Health Checks ===${RESET}"
echo ""

for i in "${!APP_NAMES[@]}"; do
  name="${APP_NAMES[$i]}"
  port="${APP_PORTS[$i]}"

  if response=$(curl -sf --max-time 3 "http://localhost:${port}/health" 2>/dev/null); then
    echo -e "  ${GREEN}[OK]${RESET}   ${name} (port ${port}) — ${response}"
    healthy=$((healthy + 1))
  else
    echo -e "  ${RED}[DOWN]${RESET} ${name} (port ${port})"
  fi
done

echo ""
echo -e "${BOLD}=== Next.js App Checks ===${RESET}"
echo ""

for i in "${!NEXT_NAMES[@]}"; do
  name="${NEXT_NAMES[$i]}"
  port="${NEXT_PORTS[$i]}"

  if curl -sf --max-time 3 "http://localhost:${port}/" > /dev/null 2>&1; then
    echo -e "  ${GREEN}[OK]${RESET}   ${name} (port ${port})"
  else
    echo -e "  ${YELLOW}[DOWN]${RESET} ${name} (port ${port})"
  fi
done

echo ""
echo -e "${BOLD}Summary:${RESET} ${healthy}/${total} Express apps healthy"
echo ""

if [ "$healthy" -eq "$total" ]; then
  exit 0
else
  exit 1
fi
