#!/usr/bin/env bash

# Expand ~ and resolve to an absolute path Node/chokidar can consume on Windows Git Bash.
normalize_target() {
  local target="$1"

  case "$target" in
    "~/"*) target="${HOME}${target:1}" ;;
    "~") target="$HOME" ;;
  esac

  if [ -d "$target" ]; then
    target="$(cd "$target" && pwd)"
  fi

  if command -v cygpath >/dev/null 2>&1; then
    target="$(cygpath -m "$target" 2>/dev/null || printf '%s' "$target")"
  fi

  printf '%s' "$target"
}

# chokidar-cli falls back to cmd.exe when SHELL is unset, which mangles Unix paths on Git Bash.
ensure_chokidar_shell() {
  export SHELL="${SHELL:-$(command -v bash 2>/dev/null || echo /usr/bin/bash)}"
  export MSYS2_ARG_CONV_EXCL='*'
}

print_watch_help() {
  cat <<'EOF'
Watching for .ts/.tsx changes. Interactive commands:
  r  restart — re-run analyze now
  q  exit     — stop watching
  ?  help     — show this message

Ctrl+C also stops watch.
EOF
}
