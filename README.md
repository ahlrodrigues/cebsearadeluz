# Sistema de Cadastro e Passes

API FastAPI + frontend (Vite/React + MUI) para cadastro de assistidos, controle de passes com QR Code, fluxo de entrevistas e relatórios.

## Estrutura

- `backend/requirements.txt` — dependências Python.
- `backend/app` — API FastAPI (SQLAlchemy + SQLite).
- `backend/app/tests` — testes com Pytest.
- `frontend/` — app React com autenticação e rotas por papel.

## Docker (recomendado)

- `backend/Dockerfile` — API (porta 8000)
- `frontend/Dockerfile` — build + Nginx (porta 80)
- `docker-compose.yml` — sobe backend (8000) e frontend (8080)

Comandos principais:

```bash
docker compose up --build
```

- Backend: http://127.0.0.1:8000
- Frontend: http://127.0.0.1:8080

Variáveis importantes (já configuradas no `docker-compose.yml`):

- `DATABASE_URL` — `sqlite:////data/app.db` no container.
- `ALLOW_LEGACY_QR` — `0` (somente JWT no QR por padrão).
- `PROTECT_EXAM_ROUTES` — `1` (rotas de exame exigem papel `exame` ou `admin`).
- `PROTECT_PUBLIC_SCAN` — `1` (rota genérica de scan exige `recepcao` ou `admin`).
- `REQUIRE_REGISTRATION_APPROVAL` — `0` (cadastro público já ativo por padrão; ajuste para `1` se desejar aprovar manualmente).
- `SECRET_KEY` — troque em produção.

## Execução local (sem Docker)

Backend:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
export PROTECT_EXAM_ROUTES=1 PROTECT_PUBLIC_SCAN=1 ALLOW_LEGACY_QR=0 SECRET_KEY=dev-key
uvicorn app.main:app --reload --app-dir backend
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Autenticação e papéis

- Login: `POST /auth/login` retorna `access_token` e `refresh_token`.
- Papéis previstos: `user`, `recepcao`, `entrevista`, `exame`, `admin`.
- Proteções relevantes (lado servidor):
  - `/passes/scan-kiosk` — `recepcao` ou `admin`.
  - `/passes/scan` — protegido por `PROTECT_PUBLIC_SCAN` (recomendado `1`).
  - `/users/{id}/qr-token` — apenas `admin`.
  - `/users/{id}/exam*` — controlado por `PROTECT_EXAM_ROUTES` (`exame` ou `admin`).
  - Relatórios de leitura — apenas `admin`.

## Seed de dados demo

Usuários com papéis (admin, recepcao, entrevista, exame, user) e um assistido com ficha:

```bash
DATABASE_URL=sqlite:///./app.db python -m backend.scripts.seed_demo_auth
```

Popular passes com presenças/faltas e entrevistas agendadas:

```bash
python -m backend.scripts.seed_pass_data
```

Senhas demo: `Demo@1234`.

## Roteiro de teste ponta a ponta

1) Cadastro do assistido
- Acesse `http://127.0.0.1:8080/signup` e crie o cadastro.
- Se `REQUIRE_REGISTRATION_APPROVAL=1`, entre como `admin` em `http://127.0.0.1:8080/login` e ative o usuário em `Users` (status: Ativo).

2) Acesso do assistido e QR
- Faça login como o assistido e acesse `Meu QR` em `/app/assistido/qr`.
- A página exibe um QR JWT (token interno não é exibido).

3) Registro de presença (recepção)
- Faça login como `recepcao` e acesse `/kiosk`.
- Aponte o leitor para o QR do assistido (ou cole o token) para registrar presença.
- Um ticket sequencial do dia é exibido; verifique o log em `/reports/scans` (somente `admin`).

4) Acompanhar passes
- Em `Users` → ação "Controle de passes" (`/users/:id/passes`) acompanhe sessões, presenças/ausências e avanço de estágio (P1 → … → P4B).
- Para testar ausência manualmente: use o botão de registrar ausência na página ou a API `/users/{id}/passes/absence`.

5) Entrevista e ficha de exame
- Após concluir um ciclo que requer entrevista, acesse `/interviews` (papéis `entrevista` ou `admin`) para ver a fila.
- Agende (`PUT /exams/{user_id}/schedule`) e conclua (`POST /exams/{user_id}/complete`) a entrevista pelo painel.
- Edite/crie a ficha do exame em `/users/:id/exam` (papéis `exame` ou `admin`).

6) Próximo ciclo
- Ao concluir ciclo/entrevista, o próximo ciclo é preparado conforme regras em `backend/app/passes.py`; valide a data da próxima sessão.

## Testes automatizados

```bash
pytest backend/app/tests
```

## Notas de segurança

- A leitura genérica via `/passes/scan` é protegida por padrão (`PROTECT_PUBLIC_SCAN=1`). Em cenários de desenvolvimento, defina `0` para testes pontuais.
- Geração de QR de terceiros (`/users/{id}/qr-token`) é restrita a `admin`; o próprio usuário usa `/me/qr-token`.
- Desabilite `ALLOW_LEGACY_QR` em produção (já está `0` no compose).

## Próximos passos

- Ajustes finos no fluxo de aprovação de cadastro público.
- Exportação/relatórios adicionais (CSV/PDF) e indicadores de entrevistas pendentes.
