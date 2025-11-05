#!/usr/bin/env bash
set -euo pipefail

# SMTP login test using .env variables.
# Usage: ./deploy/scripts/test_SMTP.sh

APP_DIR=${APP_DIR:-/opt/cebsearadeluz}

if [[ -f "$APP_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$APP_DIR/.env"
  set +a
else
  echo "[smtp-test] WARNING: .env not found at $APP_DIR; relying on current environment." >&2
fi

python3 - <<'PY'
import os, smtplib, ssl

h = os.getenv("SMTP_HOST")
p = int(os.getenv("SMTP_PORT", "587"))
u = os.getenv("SMTP_USER")
pw = os.getenv("SMTP_PASS")
st = os.getenv("SMTP_STARTTLS", "1") == "1"
ssl_flag = os.getenv("SMTP_SSL", "0") == "1"

print("HOST=", h, "PORT=", p, "USER=", u)
try:
    if ssl_flag:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(h, p, context=ctx, timeout=10) as s:
            if u and pw:
                s.login(u, pw)
    else:
        with smtplib.SMTP(h, p, timeout=10) as s:
            if st:
                s.starttls()
            if u and pw:
                s.login(u, pw)
    print("LOGIN OK")
except Exception as e:
    print("LOGIN ERROR:", e)
PY

