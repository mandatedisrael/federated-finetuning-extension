#!/usr/bin/env bash
# Regenerate sdk/src/coordinator/abi.ts from the compiled Coordinator artifact.
# Run from the repo root: bash sdk/scripts/sync-abi.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARTIFACT="$ROOT/contracts/out/Coordinator.sol/Coordinator.json"
OUT="$ROOT/sdk/src/coordinator/abi.ts"

if [ ! -f "$ARTIFACT" ]; then
  echo "Artifact missing — run 'forge build' in contracts/ first" >&2
  exit 1
fi

# Extract ABI as JSON, prefix with the TS export. The `as const` assertion
# must be on the SAME line as the closing bracket, so we drop the trailing
# newline from jq output and append it.
{
  cat <<'HEADER'
/**
 * Coordinator ABI — vendored as a `const` for full viem type inference.
 *
 * This file is generated from `contracts/out/Coordinator.sol/Coordinator.json`.
 * Regenerate after any contract change with `bash sdk/scripts/sync-abi.sh`.
 */

export const coordinatorAbi =
HEADER
  # 4-space indented JSON. Strip trailing newline from jq so the closing
  # `]` and `as const;` end up on the same line — required for TS to parse
  # the const assertion against the array literal.
  jq --indent 4 '.abi' "$ARTIFACT" | awk 'NR>1{print prev} {prev=$0} END{printf "%s", prev}'
  printf ' as const;\n'
} > "$OUT"

echo "Wrote $OUT"
