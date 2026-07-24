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

IGNORES=(
  "**/node_modules/**"
  "**/.git/**"
  "**/dist/**"
  "**/build/**"
  "**/coverage/**"
  "**/.next/**"
  "**/out/**"
)

IGNORE_ARGS=()
for pattern in "${IGNORES[@]}"; do
  IGNORE_ARGS+=(-i "$pattern")
done

# When working on the built-in samples, also re-analyze if extractors change.
if [ "$TARGET" = "./samples" ] || [ "$TARGET" = "samples" ]; then
  WATCH_GLOBS=("samples/**/*.{ts,tsx}" "src/**/*.ts")
elif [ -d "${TARGET}/src" ]; then
  WATCH_GLOBS=("${TARGET}/src/**/*.{ts,tsx}")
else
  WATCH_GLOBS=("${TARGET}/**/*.{ts,tsx}")
fi

echo "React Atlas watch"
echo "  target:  ${TARGET}"
echo "  globs:   ${WATCH_GLOBS[*]}"
echo "  note:    watches .ts/.tsx only (React/TypeScript projects)"
echo ""

EXTRA_ARGS=()
for arg in "$@"; do
  EXTRA_ARGS+=("$(printf '%q' "$arg")")
done

ensure_chokidar_shell

# Run initial analysis before starting the watcher. Exit immediately on failure
# (e.g. unsupported non-React/TS project) instead of continuing to watch.
if ! bash "${SCRIPT_DIR}/analyze-once.sh" "${TARGET}" --reanalyze ${EXTRA_ARGS[*]+"${EXTRA_ARGS[@]}"}; then
  exit 1
fi

export REACT_ATLAS_WATCH_TARGET="$TARGET"

pnpm exec chokidar "${WATCH_GLOBS[@]}" \
  "${IGNORE_ARGS[@]}" \
  --silent \
  -c "bash \"${SCRIPT_DIR}/analyze-once.sh\" \"\${REACT_ATLAS_WATCH_TARGET}\" ${EXTRA_ARGS[*]}"
