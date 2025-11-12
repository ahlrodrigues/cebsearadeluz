#!/usr/bin/env bash
set -euo pipefail

# Server-side update + test script.
# - Syncs code from a user home src dir into /opt
# - Preserves venv if present; otherwise recreates
# - Restarts backend service and validates health
# - Optionally builds/publishes frontend and performs smoke tests

APP_DIR="/opt/cebsearadeluz"
SRC_DIR="$HOME/cebsearadeluz-src"
WWW_DIR="/var/www/cebsearadeluz"
API_URL="http://127.0.0.1:8000"
BASE_PATH="/"
DO_FRONTEND=1

usage() {
  cat <<USAGE
Usage: $0 [options]
  --app-dir <path>      Target app dir (default: $APP_DIR)
  --src-dir <path>      Source dir (default: $SRC_DIR)
  --api-url <url>       Frontend API url for build (default: $API_URL)
  --base-path <path>    Frontend base path (default: $BASE_PATH)
  --skip-frontend       Do not build/publish frontend
  -h | --help           This help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir) APP_DIR="$2"; shift 2;;
    --src-dir) SRC_DIR="$2"; shift 2;;
    --api-url) API_URL="$2"; shift 2;;
    --base-path) BASE_PATH="$2"; shift 2;;
    --skip-frontend) DO_FRONTEND=0; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1;;
  esac
done

echo "==> Syncing source: $SRC_DIR -> $APP_DIR (preserving venv)"
sudo rsync -av --delete --exclude 'venv/' "$SRC_DIR/" "$APP_DIR/"
sudo chown -R cebsearadeluz:cebsearadeluz "$APP_DIR"

echo "==> Ensuring venv and backend deps"
sudo -u cebsearadeluz bash -lc "cd '$APP_DIR' && [ -x venv/bin/python ] || python3 -m venv venv; \
  ./venv/bin/python -m pip install --upgrade pip && ./venv/bin/pip install -r backend/requirements.txt"

echo "==> Backend syntax check"
sudo -u cebsearadeluz bash -lc "cd '$APP_DIR' && ./venv/bin/python -m py_compile backend/app/main.py"

echo "==> Restarting backend service"
sudo systemctl restart cebsearadeluz-backend
sleep 1
sudo systemctl status cebsearadeluz-backend --no-pager -l | sed -n '1,12p'

echo "==> Health check"
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/docs || true)
if [ "$code" != "200" ] && [ "$code" != "301" ] && [ "$code" != "308" ]; then
  echo "[warn] Backend health check returned HTTP $code" >&2
  echo "Logs:" >&2
  sudo journalctl -u cebsearadeluz-backend -n 50 --no-pager || true
fi

if [ "$DO_FRONTEND" -eq 1 ]; then
  echo "==> Frontend build and publish (API_URL=$API_URL, BASE_PATH=$BASE_PATH)"
  sudo -u cebsearadeluz bash -lc "cd '$APP_DIR/frontend' && npm ci && VITE_API_BASE_URL='$API_URL' npx vite build --base='$BASE_PATH'"
  sudo mkdir -p "$WWW_DIR"
  sudo rsync -a --delete "$APP_DIR/frontend/dist/" "$WWW_DIR/"
  sudo /usr/sbin/nginx -t && sudo systemctl reload nginx
fi

echo "==> Basic API smoke tests"
curl -s http://127.0.0.1:8000/openapi.json >/dev/null && echo "openapi.json OK" || echo "openapi.json FAIL"
login_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8000/auth/login -H 'content-type: application/json' -d '{"email":"admin@example.com","password":"wrong"}')
if [ "$login_code" = "401" ]; then echo "login 401 OK"; else echo "login check WARN ($login_code)"; fi

echo "==> SMTP diagnostics"
set +e
sudo -u cebsearadeluz bash -lc "cd '$APP_DIR' && . ./venv/bin/activate >/dev/null 2>&1; \
  set -a; [ -f .env ] && . ./.env; set +a; \
  python - <<'PY'
import os
host = os.getenv('SMTP_HOST')
user = os.getenv('SMTP_USER')
fromaddr = os.getenv('SMTP_FROM') or user
front = os.getenv('FRONTEND_BASE_URL')
print('[smtp] SMTP_HOST=', host)
print('[smtp] SMTP_FROM=', fromaddr)
print('[smtp] FRONTEND_BASE_URL=', front)
if not host or not fromaddr:
    print('[smtp] Not configured: confirmation e-mails will be logged to console if triggered.')
PY"
set -e

echo "Done."

echo "==> Installing/updating daily cron for interview no-shows"
CRON_FILE="/etc/cron.d/cebsearadeluz-process-interviews"
CRON_LINE="30 22 * * * cebsearadeluz DATE_REF= \"\" cd /opt/cebsearadeluz && DATABASE_URL=sqlite:////var/lib/cebsearadeluz/app.db /opt/cebsearadeluz/venv/bin/python -m backend.scripts.process_interview_no_shows >> /var/log/cebsearadeluz-cron.log 2>&1"
sudo bash -lc "printf '%s\n' '# Auto: process daily interview no-shows' '$CRON_LINE' > '$CRON_FILE' && chmod 0644 '$CRON_FILE' && (service cron reload || systemctl restart cron || true) && touch /var/log/cebsearadeluz-cron.log || true"
echo "Cron installed at $CRON_FILE (runs 22:30 daily)"

echo "==> Installing/updating daily cron for auto deactivation (>90d)"
CRON_FILE2="/etc/cron.d/cebsearadeluz-auto-deactivate"
CRON_LINE2="15 23 * * * cebsearadeluz MONTHS=3 cd /opt/cebsearadeluz && DATABASE_URL=sqlite:////var/lib/cebsearadeluz/app.db /opt/cebsearadeluz/venv/bin/python -m backend.scripts.enforce_auto_deactivation >> /var/log/cebsearadeluz-cron.log 2>&1"
sudo bash -lc "printf '%s\n' '# Auto: deactivate users with >90d without presence (daily)' '$CRON_LINE2' > '$CRON_FILE2' && chmod 0644 '$CRON_FILE2' && (service cron reload || systemctl restart cron || true) && touch /var/log/cebsearadeluz-cron.log || true"
echo "Cron installed at $CRON_FILE2 (runs 23:15 daily)"
