#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [ ! -d .venv ]; then
  echo "Criando ambiente virtual em .venv" >&2
  python3 -m venv .venv
  source .venv/bin/activate
  pip install --upgrade pip
  pip install -r backend/requirements.txt
else
  source .venv/bin/activate
fi

uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port 8000 &
UVICORN_PID=$!

python - <<'PY'
import time
import webbrowser

time.sleep(2)
webbrowser.open("http://127.0.0.1:8000/docs")
PY

wait "$UVICORN_PID"
