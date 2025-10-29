#!/usr/bin/env bash
set -euo pipefail

# Generate self-signed certs for local HTTPS development
#
# Usage:
#   DEV_LAN_IP=192.168.15.72 bash frontend/scripts/gen-dev-certs.sh
#   # or simply:
#   bash frontend/scripts/gen-dev-certs.sh
#
# Output files:
#   frontend/certs/dev.key
#   frontend/certs/dev.crt
#
# Vite will pick these when running: npm run dev:https

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$HERE/.." && pwd)"
CERT_DIR="$FRONTEND_DIR/certs"
mkdir -p "$CERT_DIR"

# Build host list (localhost + loopbacks + optional LAN IP)
LAN_IP="${DEV_LAN_IP:-}"
HOSTS=("localhost" "127.0.0.1" "::1")
if [ -n "$LAN_IP" ]; then
  HOSTS+=("$LAN_IP")
fi

echo "Generating dev TLS certs for: ${HOSTS[*]}" >&2

# Prefer mkcert if available (trusts locally and is simplest)
if command -v mkcert >/dev/null 2>&1; then
  echo "mkcert found; generating certificates..." >&2
  mkcert -key-file "$CERT_DIR/dev.key" -cert-file "$CERT_DIR/dev.crt" "${HOSTS[@]}"
  echo "Done: $CERT_DIR/dev.key | $CERT_DIR/dev.crt" >&2
  exit 0
fi

echo "mkcert not found; falling back to OpenSSL self-signed (you may need to accept the cert in browser)." >&2

# Create a temporary OpenSSL config with SAN entries
TMP_CONF="$(mktemp)"
trap 'rm -f "$TMP_CONF"' EXIT

cat >"$TMP_CONF" <<'CONF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
CN = Local Dev

[req_ext]
subjectAltName = @alt_names

[alt_names]
CONF

# Fill alt_names dynamically
DNS_I=1
IP_I=1
for H in "${HOSTS[@]}"; do
  if [[ "$H" =~ ^[0-9a-fA-F:.]+$ ]]; then
    echo "IP.$IP_I = $H" >>"$TMP_CONF"
    IP_I=$((IP_I+1))
  else
    echo "DNS.$DNS_I = $H" >>"$TMP_CONF"
    DNS_I=$((DNS_I+1))
  fi
done

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "$CERT_DIR/dev.key" -out "$CERT_DIR/dev.crt" \
  -config "$TMP_CONF" -extensions req_ext >/dev/null 2>&1

echo "Done: $CERT_DIR/dev.key | $CERT_DIR/dev.crt (self-signed)" >&2

