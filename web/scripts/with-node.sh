#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <command> [args...]" >&2
  exit 1
fi

if ! command -v nvm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi
fi

if ! command -v nvm >/dev/null 2>&1; then
  echo "nvm is required but was not found. Install it first." >&2
  exit 1
fi

if ! nvm use --silent >/dev/null 2>&1; then
  nvm install
  nvm use --silent >/dev/null
fi

exec "$@"
