#!/usr/bin/env bash
set -euo pipefail

TARGET="${REACT_ATLAS_WATCH_TARGET:-${1:?missing analyze target}}"
shift || true

WATCH_MODE=0
if [ -n "${REACT_ATLAS_WATCH_TARGET:-}" ]; then
  WATCH_MODE=1
fi

if ! pnpm react-atlas analyze "${TARGET}" --reanalyze "$@"; then
  if [ "$WATCH_MODE" -eq 1 ]; then
    echo "" >&2
    echo "Watch mode: re-analyze failed; still watching for .ts/.tsx changes under ${TARGET}." >&2
    echo "Press q to exit, r to retry, or Ctrl+C to stop." >&2
    echo "" >&2
  fi
  exit 1
fi
