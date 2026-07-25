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

echo "Arclens watch"
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

export ARCLENS_WATCH_TARGET="$TARGET"

CHOKIDAR_PID=""
cleanup_watch() {
  if [ -n "$CHOKIDAR_PID" ] && kill -0 "$CHOKIDAR_PID" 2>/dev/null; then
    kill "$CHOKIDAR_PID" 2>/dev/null || true
    wait "$CHOKIDAR_PID" 2>/dev/null || true
  fi
}

run_watch_reanalyze() {
  bash "${SCRIPT_DIR}/analyze-once.sh" "${TARGET}" ${EXTRA_ARGS[*]+"${EXTRA_ARGS[@]}"} || true
}

pnpm exec chokidar "${WATCH_GLOBS[@]}" \
  "${IGNORE_ARGS[@]}" \
  --silent \
  -c "bash \"${SCRIPT_DIR}/analyze-once.sh\" \"\${ARCLENS_WATCH_TARGET}\" ${EXTRA_ARGS[*]}" &
CHOKIDAR_PID=$!

trap cleanup_watch EXIT INT TERM

if [ -t 0 ]; then
  echo ""
  print_watch_help
  echo ""
  while kill -0 "$CHOKIDAR_PID" 2>/dev/null; do
    if IFS= read -rsn1 -t 1 key 2>/dev/null; then
      case "$key" in
        r|R)
          echo ""
          run_watch_reanalyze
          ;;
        q|Q)
          echo ""
          cleanup_watch
          trap - EXIT INT TERM
          exit 0
          ;;
        h|H|\?)
          echo ""
          print_watch_help
          echo ""
          ;;
      esac
    fi
  done
fi

wait "$CHOKIDAR_PID"
