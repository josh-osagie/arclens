#!/usr/bin/env bash
set -euo pipefail

while [ "${1:-}" = "--" ]; do
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

TARGET="$(normalize_target "${1:-./samples}")"
shift || true

EXTRA_ARGS=()
for arg in "$@"; do
  EXTRA_ARGS+=("$(printf '%q' "$arg")")
done

pnpm exec concurrently \
  -n analyze,viewer \
  -c blue,yellow \
  "pnpm analyze:watch -- \"${TARGET}\" ${EXTRA_ARGS[*]}" \
  "VITE_ATLAS_PROJECT_ROOT=\"${TARGET}\" pnpm dev:viewer"
