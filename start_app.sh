#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [ ! -d .venv ]; then
  echo "Criando ambiente virtual em .venv" >&2
  python3 -m venv .venv
fi

echo "Instalando dependências do backend (venv)..." >&2
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r backend/requirements.txt

BACKEND_PORT="${BACKEND_PORT:-8000}"

in_use() {
  local host="$1" port="$2"
  (echo >/dev/tcp/$host/$port) >/dev/null 2>&1 && return 0 || return 1
}

UVICORN_PID=""
if in_use 127.0.0.1 "$BACKEND_PORT"; then
  echo "Backend já está rodando em :$BACKEND_PORT; não iniciarei outro." >&2
else
  echo "Iniciando backend (uvicorn) em :$BACKEND_PORT..." >&2
  ./.venv/bin/python -m uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port "$BACKEND_PORT" &
  UVICORN_PID=$!
fi

BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}/docs"
python - "$BACKEND_URL" <<'PY'
import sys, time, webbrowser
time.sleep(2)
url = sys.argv[1]
try:
    webbrowser.open(url)
except Exception:
    pass
PY

trap 'echo Encerrando...; [ -n "$UVICORN_PID" ] && kill "$UVICORN_PID" 2>/dev/null || true' INT TERM EXIT

FRONTEND_PORT_BASE="${FRONTEND_PORT:-5173}"
PORT_TRY=$FRONTEND_PORT_BASE
while in_use 127.0.0.1 "$PORT_TRY"; do
  PORT_TRY=$((PORT_TRY+1))
done

echo "Instalando deps do frontend e iniciando Vite em :$PORT_TRY..." >&2
cd "$PROJECT_DIR/frontend"
npm install
npm run dev -- --host --port "$PORT_TRY" --strictPort=false
