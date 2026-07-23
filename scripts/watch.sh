#!/usr/bin/env bash
set -euo pipefail

while [ "${1:-}" = "--" ]; do
  shift
done

TARGET="${1:-./samples}"

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
echo ""

pnpm exec chokidar "${WATCH_GLOBS[@]}" \
  "${IGNORE_ARGS[@]}" \
  --silent \
  -c "pnpm react-atlas analyze \"${TARGET}\"" \
  --initial
