Staging sem Docker (systemd + Nginx)

Este guia sobe o backend FastAPI via systemd e serve o frontend (build estático) com Nginx no mesmo domínio, sem containers.

Visão geral
- Backend: uvicorn em 127.0.0.1:8000
- Frontend: Nginx servindo os arquivos estáticos de frontend e fazendo proxy para a API em paths específicos
- Um único domínio (ex.: app.exemplo.com). O frontend faz chamadas relativas para a API (VITE_API_BASE_URL em branco no build)

Pré‑requisitos
- Servidor Linux (Ubuntu 22.04+ recomendado) com acesso root/sudo
- DNS apontando para o servidor (ex.: app.exemplo.com)
- pacotes: python3.12, python3-venv, nodejs (v18+ ou 20), npm, nginx, certbot (opcional para HTTPS)

1) Estrutura de diretórios
```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin cebsearadeluz || true
sudo mkdir -p /opt/cebsearadeluz /var/lib/cebsearadeluz /var/www/cebsearadeluz
sudo chown -R cebsearadeluz:cebsearadeluz /opt/cebsearadeluz /var/lib/cebsearadeluz
sudo chown -R www-data:www-data /var/www/cebsearadeluz
```

2) Copiar o código
- Faça clone ou cópia do repositório para `/opt/cebsearadeluz`:
```bash
sudo rsync -a --delete ./ /opt/cebsearadeluz/
sudo chown -R cebsearadeluz:cebsearadeluz /opt/cebsearadeluz
```

3) Variáveis de ambiente
- Copie o exemplo para o servidor e ajuste valores fortes/definitivos:
```bash
sudo -u cebsearadeluz cp /opt/cebsearadeluz/deploy/.env.staging /opt/cebsearadeluz/.env
sudo -u cebsearadeluz nano /opt/cebsearadeluz/.env
```
- Banco: por padrão usaremos SQLite em `/var/lib/cebsearadeluz/app.db` via `DATABASE_URL=sqlite:////var/lib/cebsearadeluz/app.db` (definido no unit). Pode trocar para Postgres conforme necessário.

4) Backend (venv + systemd)
```bash
sudo -u cebsearadeluz bash -lc 'cd /opt/cebsearadeluz && python3 -m venv venv && ./venv/bin/python -m pip install --upgrade pip && ./venv/bin/pip install -r backend/requirements.txt'

sudo cp /opt/cebsearadeluz/deploy/systemd/cebsearadeluz-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cebsearadeluz-backend
```

5) Frontend (build + Nginx)
```bash
sudo -u cebsearadeluz bash -lc 'cd /opt/cebsearadeluz/frontend && npm ci && VITE_API_BASE_URL="" npm run build'
sudo rsync -a --delete /opt/cebsearadeluz/frontend/dist/ /var/www/cebsearadeluz/

sudo cp /opt/cebsearadeluz/deploy/nginx/cebsearadeluz.conf /etc/nginx/sites-available/
sudo sed -i 's/app.example.com/SEU_DOMINIO_AQUI/g' /etc/nginx/sites-available/cebsearadeluz.conf
sudo ln -sf /etc/nginx/sites-available/cebsearadeluz.conf /etc/nginx/sites-enabled/cebsearadeluz.conf
sudo nginx -t && sudo systemctl reload nginx
```
- HTTPS (opcional, recomendado):
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO_AQUI
```

6) Atualizações (deploy)
Use o script pronto para atualizar código, deps, rebuild do frontend e restart:
```bash
sudo /opt/cebsearadeluz/deploy/scripts/deploy_nodocker.sh
```

7) Seeds (opcional)
```bash
sudo -u cebsearadeluz bash -lc 'cd /opt/cebsearadeluz && DATABASE_URL="sqlite:////var/lib/cebsearadeluz/app.db" ./venv/bin/python -m backend.scripts.seed_demo_auth && ./venv/bin/python -m backend.scripts.seed_pass_data'
```

Logs e troubleshooting
- Backend: `journalctl -u cebsearadeluz-backend -f`
- Nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

Hardening
- Gere `SECRET_KEY` forte no `.env` e rotacione senhas SMTP.
- Para Postgres, defina `DATABASE_URL` e instale libs client (e.g., `psycopg` no requirements e pacote do SO se necessário).

