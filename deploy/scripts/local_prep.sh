#!/usr/bin/env bash
set -euo pipefail

# Local prep script: validates backend syntax, builds frontend artifacts,
# and prints rsync/ssh commands for deployment to the remote server.

# Config (override via env)
SSH_USER="${SSH_USER:-cebsearadeluz}"
SSH_HOST="${SSH_HOST:-143.137.76.39}"
SSH_PORT="${SSH_PORT:-50022}"
REMOTE_HOME_SRC="${REMOTE_HOME_SRC:-~/cebsearadeluz-src}"
BASE_PATH="${BASE_PATH:-/}"             # e.g. "/" or "/registroakashico/"
API_URL="${API_URL:-http://143.137.76.39}"

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

echo "==> Checking required tools (node, npm, python3, rsync, ssh)"
for bin in node npm python3 rsync ssh; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Missing required tool: $bin" >&2; exit 1; }
done

echo "==> Backend: syntax check"
python3 -m py_compile backend/app/main.py || { echo "Backend syntax error" >&2; exit 1; }

echo "==> Frontend: install deps and build (BASE_PATH=$BASE_PATH, API_URL=$API_URL)"
pushd frontend >/dev/null
npm ci
VITE_API_BASE_URL="$API_URL" npx vite build --base="$BASE_PATH"
popd >/dev/null

echo
echo "Prep complete. To upload to the server, run:" 
cat <<CMD
rsync -avz --delete -e "ssh -p $SSH_PORT" \
  --exclude ".git" --exclude ".venv" --exclude "node_modules" --exclude ".pytest_cache" \
  --exclude "app.db" --exclude "test.db" ./ \
  $SSH_USER@$SSH_HOST:$REMOTE_HOME_SRC/

# Then SSH and run the server update script there (see deploy/scripts/server_update_and_test.sh)
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST \
  'bash -lc "chmod +x $REMOTE_HOME_SRC/deploy/scripts/server_update_and_test.sh && \
             $REMOTE_HOME_SRC/deploy/scripts/server_update_and_test.sh \
               --app-dir /opt/cebsearadeluz \
               --src-dir $REMOTE_HOME_SRC \
               --api-url $API_URL \
               --base-path $BASE_PATH"'
CMD

echo
echo "Tip: set SSH_USER/SSH_HOST/SSH_PORT/API_URL/BASE_PATH env vars to customize."

