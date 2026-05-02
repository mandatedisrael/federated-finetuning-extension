#!/usr/bin/env bash
# Regenerate vendored ABI files from compiled Foundry artifacts.
# Run from the repo root: bash sdk/scripts/sync-abi.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

sync_abi() {
  local artifact="$1"
  local out="$2"
  local export_name="$3"
  local description="$4"

  if [ ! -f "$artifact" ]; then
    echo "Artifact missing: $artifact — run 'forge build' in contracts/ first" >&2
    exit 1
  fi

  {
    cat <<HEADER
/**
 * ${description} — vendored as a \`const\` for full viem type inference.
 *
 * This file is generated from \`${artifact#$ROOT/}\`.
 * Regenerate after any contract change with \`bash sdk/scripts/sync-abi.sh\`.
 */

export const ${export_name} =
HEADER
    jq --indent 4 '.abi' "$artifact" | awk 'NR>1{print prev} {prev=$0} END{printf "%s", prev}'
    printf ' as const;\n'
  } > "$out"

  echo "Wrote $out"
}

sync_abi \
  "$ROOT/contracts/out/Coordinator.sol/Coordinator.json" \
  "$ROOT/sdk/src/coordinator/abi.ts" \
  "coordinatorAbi" \
  "Coordinator ABI"

sync_abi \
  "$ROOT/contracts/out/INFTMinter.sol/INFTMinter.json" \
  "$ROOT/sdk/src/inft/abi.ts" \
  "inftMinterAbi" \
  "INFTMinter ABI"
