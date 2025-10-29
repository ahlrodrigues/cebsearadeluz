#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/cebsearadeluz"
WWW_DIR="/var/www/cebsearadeluz"

echo "==> Atualizando código (se o diretório for um clone git, ajuste este passo conforme seu fluxo)"
# Exemplo: git pull; aqui assumimos que os arquivos já foram sincronizados (rsync/CI)

echo "==> Instalando/atualizando deps do backend (venv)"
sudo -u cebsearadeluz bash -lc "cd '$APP_DIR' && [ -d venv ] || python3 -m venv venv && ./venv/bin/python -m pip install --upgrade pip && ./venv/bin/pip install -r backend/requirements.txt"

echo "==> Build do frontend"
sudo -u cebsearadeluz bash -lc "cd '$APP_DIR/frontend' && npm ci && VITE_API_BASE_URL='' npm run build"

echo "==> Publicando frontend para $WWW_DIR"
sudo rsync -a --delete "$APP_DIR/frontend/dist/" "$WWW_DIR/"

echo "==> Reiniciando backend"
sudo systemctl restart cebsearadeluz-backend

echo "==> Recarregando Nginx"
sudo nginx -t && sudo systemctl reload nginx

echo "OK. Deploy concluído."

