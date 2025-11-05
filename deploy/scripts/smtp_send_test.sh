#!/usr/bin/env bash
set -euo pipefail

# Wrapper to source .env and call smtp_send_test.py
# Usage: ./deploy/scripts/smtp_send_test.sh you@example.com

APP_DIR=${APP_DIR:-/opt/cebsearadeluz}

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 recipient@example.com [Subject]" >&2
  exit 2
fi

TO="$1"; shift || true
SUBJECT=${1:-"SMTP test: CEB Seara de Luz"}

cd "$APP_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
else
  echo "[smtp-test] WARNING: .env not found at $APP_DIR; relying on current environment." >&2
fi

python3 ./deploy/scripts/smtp_send_test.py --to "$TO" --subject "$SUBJECT"

