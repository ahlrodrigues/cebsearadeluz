Staging deployment guide

This repo already runs cleanly with Docker Compose. The files in deploy/ add a simple, secure staging setup using two subdomains, Docker, and Caddy for HTTPS.

What you get
- Backend FastAPI on api-staging.example.com (port 443 via Caddy)
- Frontend React on staging.example.com (port 443 via Caddy)
- Docker Compose stack with restart policies and a volume for SQLite data

Prereqs
- A VPS or VM (Ubuntu 22.04+ recommended)
- Two DNS records pointing to the server IP:
  - staging.example.com
  - api-staging.example.com
- Docker and Docker Compose plugin installed
- Caddy installed (for automatic HTTPS)

1) Copy repo to the server
- Clone the repo or rsync it. From the repo root:
  - cp deploy/.env.staging .env
  - Edit .env and set strong values (SECRET_KEY, SMTP_*, etc.). Never commit real secrets.

2) Configure Caddy
- Edit deploy/caddy/Caddyfile and replace staging.example.com and api-staging.example.com with your domains.
- Copy the file into place (requires sudo):
  - sudo mkdir -p /etc/caddy
  - sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile
  - sudo systemctl restart caddy

3) Start the stack
- Build and start with compose, passing API_BASE for the frontend build:

  docker compose \
    -f docker-compose.yml \
    -f deploy/docker-compose.staging.yml \
    build --build-arg API_BASE=https://api-staging.example.com

  docker compose \
    -f docker-compose.yml \
    -f deploy/docker-compose.staging.yml \
    up -d

Services
- Backend: internal on http://127.0.0.1:8000 (Caddy proxies TLS traffic)
- Frontend: internal on http://127.0.0.1:8080 (Caddy proxies TLS traffic)

4) Seed demo data (optional)
- SSH into the server and run inside the repo:

  docker compose -f docker-compose.yml -f deploy/docker-compose.staging.yml exec backend \
    bash -lc 'DATABASE_URL="$DATABASE_URL" python -m backend.scripts.seed_demo_auth && python -m backend.scripts.seed_pass_data'

5) Rollouts
- Rebuild only what changed and restart:

  docker compose -f docker-compose.yml -f deploy/docker-compose.staging.yml build
  docker compose -f docker-compose.yml -f deploy/docker-compose.staging.yml up -d

6) Notes and hardening
- SECRET_KEY: set a strong random value in .env (don’t use defaults).
- SMTP: prefer an app password or a dedicated provider. Rotate any credentials stored in previous local .env files.
- SQLite: staging uses a local volume for simplicity. For production or higher concurrency, consider Postgres and set DATABASE_URL accordingly.
- Backups: snapshot the backend_data volume periodically if you keep SQLite.
- Logs: view with docker compose logs -f backend or frontend, and journalctl -u caddy for proxy.

