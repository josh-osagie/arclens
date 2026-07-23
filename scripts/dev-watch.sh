#!/usr/bin/env bash
set -euo pipefail

while [ "${1:-}" = "--" ]; do
  shift
done

TARGET="${1:-./samples}"

pnpm exec concurrently \
  -n analyze,viewer \
  -c blue,yellow \
  "pnpm analyze:watch -- \"${TARGET}\"" \
  "pnpm dev:viewer"
