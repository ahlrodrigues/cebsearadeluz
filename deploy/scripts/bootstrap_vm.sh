#!/usr/bin/env bash
set -euo pipefail

# Bootstrap a fresh Ubuntu VM to run this app without Docker.
# - Installs packages (nginx, python3-venv, certbot)
# - Creates system user and directories
# - Copies systemd + nginx configs
# - Builds and deploys frontend (optional)
#
# Usage:
#   sudo bash deploy/scripts/bootstrap_vm.sh \
#     --server-name 143.137.76.39 \
#     --with-frontend    # include to build and publish the SPA
#
# Later, when you have a domain for HTTPS, re-run nginx/certbot steps:
#   sudo sed -i 's/server_name .*/server_name api.seu-dominio.com;/' /etc/nginx/sites-available/cebsearadeluz.conf
#   sudo nginx -t && sudo systemctl reload nginx
#   sudo certbot --nginx -d api.seu-dominio.com

SERVER_NAME=""
WITH_FRONTEND=0
API_URL=""
BASE_PATH="/"
INIT_DB=0
SEED_DEMO=0
SEED_PASSES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-name)
      SERVER_NAME="$2"; shift; shift;;
    --api-url)
      API_URL="$2"; shift; shift;;
    --base-path)
      BASE_PATH="$2"; shift; shift;;
    --init-db)
      INIT_DB=1; shift;;
    --seed-demo)
      SEED_DEMO=1; shift;;
    --seed-passes)
      SEED_PASSES=1; shift;;
    --with-frontend)
      WITH_FRONTEND=1; shift;;
    -h|--help)
      cat <<USAGE
Usage: $0 --server-name <ip-or-domain> [options]

Options:
  --with-frontend              Compila e publica o frontend estático nesta VM
  --api-url <url>              URL base da API usada no build do frontend (default: http://<server-name>)
  --base-path </path/>         Subcaminho público do frontend (default: "/") ex.: "/registroakashico/"
  --init-db                    Cria o schema do banco (tabelas) antes de iniciar o serviço
  --seed-demo                  Popula usuários demo (admin, recepção, etc.)
  --seed-passes                Popula dados de passes demo
USAGE
      exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

if [[ -z "$SERVER_NAME" ]]; then
  echo "--server-name is required (IP or domain)" >&2
  exit 1
fi

if [[ -z "$API_URL" ]]; then
  API_URL="http://$SERVER_NAME"
fi

APP_DIR="/opt/cebsearadeluz"
DATA_DIR="/var/lib/cebsearadeluz"
WWW_DIR="/var/www/cebsearadeluz"

as_user() {
  # Run a command as a specific user, with fallbacks if sudo is unavailable
  local user="$1"; shift
  if command -v sudo >/dev/null 2>&1; then
    sudo -u "$user" bash -lc "$*"
  elif command -v runuser >/dev/null 2>&1; then
    runuser -u "$user" -- bash -lc "$*"
  else
    su -s /bin/bash -c "$*" "$user"
  fi
}

echo "==> Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx python3-venv python3-pip git certbot python3-certbot-nginx rsync

# Ensure PATH includes sbin for non-login shells
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

echo "==> Ensuring Node.js 20.x is installed"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v 2>/dev/null | sed 's/^v//; s/\..*$//') || NODE_MAJOR=0
else
  NODE_MAJOR=0
fi
if [ "$NODE_MAJOR" -lt 20 ]; then
  if ! command -v curl >/dev/null 2>&1; then
    apt-get install -y curl
  fi
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Creating user and directories"
id -u cebsearadeluz >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin cebsearadeluz
mkdir -p "$APP_DIR" "$DATA_DIR" "$WWW_DIR"
chown -R cebsearadeluz:cebsearadeluz "$APP_DIR" "$DATA_DIR"
chown -R www-data:www-data "$WWW_DIR"

echo "==> Python venv and backend dependencies"
as_user cebsearadeluz "cd '$APP_DIR' && python3 -m venv venv && ./venv/bin/python -m pip install --upgrade pip && [ -f backend/requirements.txt ] && ./venv/bin/pip install -r backend/requirements.txt || true"

if [[ "$INIT_DB" -eq 1 ]]; then
  echo "==> Initializing database schema (create_all)"
  as_user cebsearadeluz "cd '$APP_DIR' && DATABASE_URL='sqlite:////var/lib/cebsearadeluz/app.db' ./venv/bin/python - <<'PY'"
from backend.app.database import engine, Base
from backend.app import models
Base.metadata.create_all(bind=engine)
print('[db] schema created')
PY
fi

if [[ "$SEED_DEMO" -eq 1 ]]; then
  echo "==> Seeding demo auth users"
  as_user cebsearadeluz "cd '$APP_DIR' && DATABASE_URL='sqlite:////var/lib/cebsearadeluz/app.db' ./venv/bin/python -m backend.scripts.seed_demo_auth"
fi

if [[ "$SEED_PASSES" -eq 1 ]]; then
  echo "==> Seeding passes demo data"
  as_user cebsearadeluz "cd '$APP_DIR' && DATABASE_URL='sqlite:////var/lib/cebsearadeluz/app.db' ./venv/bin/python -m backend.scripts.seed_pass_data"
fi

echo "==> Systemd service"
install -m 0644 "$APP_DIR/deploy/systemd/cebsearadeluz-backend.service" /etc/systemd/system/cebsearadeluz-backend.service
systemctl daemon-reload
systemctl enable --now cebsearadeluz-backend || true

echo "==> Nginx site"
install -m 0644 "$APP_DIR/deploy/nginx/cebsearadeluz.conf" /etc/nginx/sites-available/cebsearadeluz.conf
sed -i "s/server_name .*/server_name $SERVER_NAME; # updated by bootstrap/" /etc/nginx/sites-available/cebsearadeluz.conf || true
ln -sf /etc/nginx/sites-available/cebsearadeluz.conf /etc/nginx/sites-enabled/cebsearadeluz.conf
/usr/sbin/nginx -t && systemctl reload nginx

if [[ $WITH_FRONTEND -eq 1 ]]; then
  echo "==> Building and publishing frontend"
  echo "     API URL: $API_URL"
  echo "  BASE PATH: $BASE_PATH"
  as_user cebsearadeluz "cd '$APP_DIR/frontend' && npm ci && VITE_API_BASE_URL='$API_URL' npx vite build --base='$BASE_PATH'"
  rsync -a --delete "$APP_DIR/frontend/dist/" "$WWW_DIR/"
  /usr/sbin/nginx -t && systemctl reload nginx
fi

echo "All done. Test: http://$SERVER_NAME/ (SPA if built) and http://$SERVER_NAME/docs (API via proxy)."
