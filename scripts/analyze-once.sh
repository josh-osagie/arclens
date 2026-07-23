#!/usr/bin/env bash
set -euo pipefail

TARGET="${REACT_ATLAS_WATCH_TARGET:-${1:?missing analyze target}}"
shift || true

exec pnpm react-atlas analyze "${TARGET}" --reanalyze "$@"
