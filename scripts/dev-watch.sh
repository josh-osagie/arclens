#!/usr/bin/env bash
set -euo pipefail

while [ "${1:-}" = "--" ]; do
  shift
done

TARGET="${1:-./samples}"
ABS_TARGET="$(cd "${TARGET}" && pwd)"

pnpm exec concurrently \
  -n analyze,viewer \
  -c blue,yellow \
  "pnpm analyze:watch -- \"${TARGET}\"" \
  "VITE_ATLAS_PROJECT_ROOT=\"${ABS_TARGET}\" pnpm dev:viewer"
