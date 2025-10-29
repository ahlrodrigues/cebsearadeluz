#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Carrega variáveis de ambiente do arquivo .env (se existir)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

usage() {
  cat >&2 <<USAGE
Uso: $0 [opções]
  -b, --backend          Inicia somente o backend (uvicorn)
  -f, --frontend         Inicia somente o frontend (Vite)
  -a, --both             Inicia backend e frontend (padrão)
  -s, --stop-backend     Encerra o backend escutando na porta BACKEND_PORT (padrão 8000)
  -r, --restart-backend  Reinicia o backend (encerra se necessário e inicia)
      --force            Ao iniciar o backend, encerra o processo que estiver usando a porta
USAGE
}

# Parse de argumentos
MODE="both"
FORCE_RESTART=0
while [ $# -gt 0 ]; do
  case "$1" in
    -b|--backend) MODE="backend";;
    -f|--frontend) MODE="frontend";;
    -a|--both) MODE="both";;
    -s|--stop-backend) MODE="stop_backend";;
    -r|--restart-backend) MODE="restart_backend";;
    --force|--force-restart) FORCE_RESTART=1;;
    -h|--help) usage; exit 0;;
    *) echo "Opção inválida: $1" >&2; usage; exit 1;;
  esac
  shift
done

in_use() {
  local host="$1" port="$2"
  (echo >/dev/tcp/$host/$port) >/dev/null 2>&1 && return 0 || return 1
}

kill_port() {
  local port="$1"
  echo "Encerrando processos na porta :$port (se houver)..." >&2
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "$port"/tcp >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    [ -n "$pids" ] && kill $pids 2>/dev/null || true
  elif command -v ss >/dev/null 2>&1; then
    local pids
    pids=$(ss -ltnp "sport = :$port" 2>/dev/null | awk -F',' '/pid=/ {print $2}' | sed 's/pid=//' | tr -d ' ')
    [ -n "$pids" ] && kill $pids 2>/dev/null || true
  else
    pkill -f "uvicorn .* --port $port" 2>/dev/null || true
  fi
}

stop_backend() {
  local BACKEND_PORT="${BACKEND_PORT:-8000}"
  kill_port "$BACKEND_PORT"
  # Aguarda liberação
  for i in $(seq 1 20); do
    in_use 127.0.0.1 "$BACKEND_PORT" || break
    sleep 0.2
  done
  if in_use 127.0.0.1 "$BACKEND_PORT"; then
    echo "[Aviso] Porta :$BACKEND_PORT ainda em uso após tentativa de encerramento." >&2
  else
    echo "Backend parado (porta :$BACKEND_PORT liberada)." >&2
  fi
}

start_backend() {
  if [ ! -d .venv ]; then
    echo "Criando ambiente virtual em .venv" >&2
    python3 -m venv .venv
  fi
  echo "Instalando dependências do backend (venv)..." >&2
  ./.venv/bin/python -m pip install --upgrade pip
  ./.venv/bin/python -m pip install -r backend/requirements.txt

  local BACKEND_PORT="${BACKEND_PORT:-8000}"
  if in_use 127.0.0.1 "$BACKEND_PORT"; then
    if [ "$FORCE_RESTART" = "1" ]; then
      echo "Porta :$BACKEND_PORT em uso. Forçando reinício..." >&2
      stop_backend
    else
      echo "Backend já está rodando em :$BACKEND_PORT; não iniciarei outro. Use --force ou --stop-backend." >&2
      return 0
    fi
  fi

  echo "Iniciando backend (uvicorn) em :$BACKEND_PORT..." >&2
  if [ "$MODE" = "backend" ]; then
    # Rodar em primeiro plano quando só backend for solicitado
    exec ./.venv/bin/python -m uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port "$BACKEND_PORT"
  else
    ./.venv/bin/python -m uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port "$BACKEND_PORT" &
    UVICORN_PID=$!
    # Aguardar o backend ficar pronto e tentar abrir a documentação
    local BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}/docs"
    echo "Aguardando backend responder em $BACKEND_URL ..." >&2
    for i in $(seq 1 20); do
      if (echo >/dev/tcp/127.0.0.1/"$BACKEND_PORT") >/dev/null 2>&1; then
        break
      fi
      sleep 0.3
    done
    # Preferir xdg-open se disponível (Linux); fallback para python webbrowser
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$BACKEND_URL" >/dev/null 2>&1 || true
    else
      python - "$BACKEND_URL" <<'PY'
import sys, time, webbrowser
url = sys.argv[1]
try:
    webbrowser.open(url)
except Exception:
    pass
PY
    fi
    echo "Backend em: $BACKEND_URL" >&2
  fi
}

start_frontend() {
  local FRONTEND_PORT_BASE="${FRONTEND_PORT:-5173}"
  local PORT_TRY=$FRONTEND_PORT_BASE
  while in_use 127.0.0.1 "$PORT_TRY"; do
    PORT_TRY=$((PORT_TRY+1))
  done

  # Detectar IP da LAN para uso no celular
  local LAN_IP="${LAN_IP:-}"
  if [ -z "$LAN_IP" ]; then
    # Tenta encontrar IP privado comum (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    LAN_IP=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' | head -n1 || true)
  fi

  # Porta real do backend
  local BACKEND_PORT="${BACKEND_PORT:-8000}"

  echo "Instalando deps do frontend e iniciando Vite em :$PORT_TRY..." >&2
  if [ -n "$LAN_IP" ]; then
    echo "Acesse pela LAN (celular/tablet):" >&2
    echo "  Frontend:  http://$LAN_IP:$PORT_TRY" >&2
    echo "  Backend:   http://$LAN_IP:$BACKEND_PORT" >&2
    echo "Definindo VITE_API_BASE_URL=http://$LAN_IP:$BACKEND_PORT para o dev server." >&2
  else
    echo "[Aviso] Não foi possível detectar IP da LAN automaticamente. Você pode definir LAN_IP=... ao chamar este script." >&2
  fi

  cd "$PROJECT_DIR/frontend"
  npm install
  if [ -n "$LAN_IP" ]; then
    VITE_API_BASE_URL="http://$LAN_IP:$BACKEND_PORT" npm run dev -- --host --port "$PORT_TRY" --strictPort=false
  else
    npm run dev -- --host --port "$PORT_TRY" --strictPort=false
  fi
}

UVICORN_PID=""

case "$MODE" in
  backend)
    start_backend
    ;;
  frontend)
    start_frontend
    ;;
  stop_backend)
    stop_backend
    ;;
  restart_backend)
    stop_backend
    start_backend
    ;;
  both)
    start_backend
    trap 'echo Encerrando...; [ -n "$UVICORN_PID" ] && kill "$UVICORN_PID" 2>/dev/null || true' INT TERM EXIT
    start_frontend
    ;;
esac
