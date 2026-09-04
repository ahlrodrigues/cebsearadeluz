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
  
Para builds acessados de outros dispositivos (sem proxy), defina a base da API no build do frontend:

```bash
# No .env (raiz):
FRONTEND_API_BASE=http://SEU_HOST:8000

# Depois:
docker compose build frontend && docker compose up -d frontend
```

Em produção, prefira HTTPS e configure `FRONTEND_API_BASE=https://SEU_HOST:8000` (ou reverse proxy para 443).

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
- Papéis previstos: `user` (assistido), `recepcao`, `entrevista`, `exame`, `admin`.
- **Múltiplos perfis por usuário:** `role` (principal) + `extra_roles` (CSV no banco). No login, o backend combina os dois numa lista `roles` embutida no JWT (`backend/app/routers/auth.py:35-41`). Toda checagem de permissão — `deps_auth.require_roles` (`backend/app/deps_auth.py:15-30`) no backend e `RoleRoute` (`frontend/src/auth/RouteGuards.tsx:11-17`) no frontend — compara contra essa lista combinada. Um usuário `role=user` com `extra_roles=[recepcao]` tem as permissões de recepção também.

### Permissões por perfil (evidenciado no código)

| Perfil | Pode fazer (backend, `require_roles`) | Rota(s) protegida(s) — evidência |
|---|---|---|
| **user** (assistido) | Só endpoints `/me*`, escopados ao próprio token (sem checagem de role, qualquer usuário autenticado acessa seus próprios dados): ver seu perfil, editar dados próprios, ver seu QR, ver seus ciclos de passe. | `main.py:349` (`GET /me`), `:372` (`PUT /me`), `:407` (`GET /me/qr-token`), `:416`/`:422` (`GET /me/pass-cycles[/active]`) |
| **recepcao** | Escanear QR no kiosk e registrar presença; reservar senhas avulsas; marcar no-show de entrevista; consultar fila/lista de exames do dia; **cadastrar novos assistidos** (papel sempre forçado para `user`, sem poder se autopromover — servidor ignora `role`/`extra_roles` elevados no payload). | `main.py:738` (`POST /passes/scan-kiosk`), `:505` (`POST /passes/scan`, se `PROTECT_PUBLIC_SCAN=1`), `:1354` (`POST /tickets/reserve`), `:1014` (`POST /exams/{id}/no-show`), `:1142`/`:1181` (`GET /exams/queue`, `/exams/today`), `:140-150` (`POST /users`, se `PROTECT_USER_ADMIN_ROUTES=1`) |
| **entrevista** | Tudo que `recepcao` faz em exames/no-show, mais: listar entrevistas concluídas, consultar fila de exames, ler ficha de exame (não editar). | `main.py:1090` (`GET /interviews/completed`), `:1142`/`:1181` (fila/hoje), `:1014` (no-show), `:224` (`GET /users/{id}/exam`, leitura, se `PROTECT_EXAM_ROUTES=1`) |
| **exame** | Ler e **editar** a ficha de exame de qualquer assistido (só quem pode criar/atualizar); ver fila de exames/hoje. Não pode marcar no-show de entrevista. | `main.py:250`/`:273` (`POST`/`PUT /users/{id}/exam`, se `PROTECT_EXAM_ROUTES=1`), `:1142`/`:1181` (fila/hoje) |
| **admin** | Acesso total: CRUD de usuários, gerar QR-token de terceiros, editar ficha de exame, relatórios de leitura, políticas administrativas (desativação automática, no-show em lote). É incluído em **todas** as checagens de `require_roles` do sistema. | `main.py:434` (`GET /users/{id}/qr-token`, sempre exigido, sem toggle), `:842`/`:876` (relatórios, `admin` apenas — nem `recepcao`/`entrevista`/`exame` acessam), `:891`/`:965` (`/admin/policies/*`) |

### Guarda de rotas no frontend (`App.tsx`, `RoleRoute roles={...}`)

| Rota | Perfis liberados | Link no menu (`AppLayout.tsx`) aparece para |
|---|---|---|
| `/users`, `/users/:id/passes` | admin, recepcao, entrevista | admin (link "Assistidos"); recepcao/entrevista só chegam via URL direta — sem link no menu |
| `/users/new` | admin, **recepcao** | admin, recepcao (link "Novo cadastro"); formulário esconde os campos de perfil/perfis adicionais para quem não é admin |
| `/users/:id/edit`, `/users/:id/qr` | admin | admin |
| `/users/:id/exam` | exame, admin | menu "Exames" (`/exams`) é o ponto de entrada, não linka direto pra ficha |
| `/scan`, `/kiosk` | recepcao, admin | recepcao, admin ("Presenças") |
| `/reports/scans` | admin, recepcao, entrevista, **exame** | admin, recepcao, entrevista (link "Relatórios") — **exame não tem link, mas a rota libera** |
| `/exams`, `/exams/today` | exame, admin | exame, admin ("Exames") |
| `/interviews` | entrevista, admin | entrevista, admin ("Entrevistas") |
| `/app/assistido/*` | user | user ("Meu QR", "Meus passes", "Meu cadastro") |

### Inconsistências encontradas ao evidenciar (não corrigidas — reportar apenas)

1. **`PROTECT_USER_ADMIN_ROUTES` é `"0"` por padrão e nunca é setado no `docker-compose.yml`.** Isso significa que, na forma como o projeto está documentado para rodar (`docker compose up`), **todas** as rotas `/users*` (exceto `/users/{id}/qr-token`, que é a única com checagem incondicional) ficam **sem autenticação alguma** — qualquer requisição HTTP sem token consegue listar todos os assistidos com PII, criar usuário `admin`, editar papel/senha de qualquer um, ou apagar cadastros (`main.py:136`, comparar com `docker-compose.yml:6-13`, que só define `PROTECT_EXAM_ROUTES=1` e `PROTECT_PUBLIC_SCAN=1`, nunca `PROTECT_USER_ADMIN_ROUTES`). É o achado mais crítico desta análise — ver seção "Próximos passos".
2. **`/reports/scans` libera `exame` no frontend, mas o backend (`GET /reports/scan-logs` e `/scan-logs/summary`, `main.py:842`/`:876`) só aceita `admin`.** Um usuário `exame` que navegue direto pra essa URL vê a página carregar e depois falhar com 403 em ambas as chamadas.
3. **`recepcao` tem permissão de backend em `/exams/queue`, `/exams/today` e `/exams/{id}/no-show`, mas nenhuma tela do frontend expõe isso a esse perfil** (só `entrevista` chega em `/interviews`, que é quem usa essas chamadas hoje). Permissão de backend "morta" na UI atual — não é risco, mas é excesso de escopo não utilizado.

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

## Erros e inconsistências conhecidas

Levantamento feito sobre as alterações pendentes (`git diff`) em 2026-09-04. Itens 1-6 **já foram corrigidos**; item 7 é uma feature aplicada a pedido. Descrição mantida para referência. Ordenado por severidade/ordem de aparição.

### 1. ~~`_normalize_extra_roles` corrompia `extra_roles` para commits subsequentes na mesma sessão~~ — corrigido (crítico)

`backend/app/crud.py` convertia `user.extra_roles` de CSV (string) para `list` **in-place**, no próprio objeto ORM anexado à sessão. Qualquer `db.commit()` posterior na mesma `Session` tentava gravar uma `list` na coluna `String(255)` e lançava `sqlite3.ProgrammingError: Error binding parameter 1: type 'list' is not supported`. Isso afetava diretamente o fluxo de scan no kiosk (`crud.get_user` seguido de `_log_scan`/`db.commit()` em `main.py`), resultando em 500 em toda leitura de presença bem-sucedida.

**Correção aplicada:** removida a mutação do objeto ORM (função `_normalize_extra_roles` e suas chamadas em `crud.py`). A conversão de CSV para lista agora acontece em `schemas.py`, via `field_validator("extra_roles", mode="before")` em `UserBase`, aplicado só na serialização da resposta — nunca no objeto persistido. O validator trata tanto string CSV quanto `None` (usuários sem `extra_roles` definido) — a versão inicial da correção só tratava string e quebrava `GET /users` com `ResponseValidationError` para qualquer usuário com `extra_roles=None`; encontrado e corrigido ao rodar a aplicação de ponta a ponta (ver seção "Validação executada" abaixo).

### 2. ~~`preferential` não podia ser desmarcado / UI "brigava" com o usuário para 60+~~ — corrigido (alto)

O backend força `preferential = True` para usuários com 60+ anos (regra de negócio mantida — ver decisão abaixo). O problema era só na UI: `UserForm.tsx` tinha um `useEffect` com `values.preferential` nas dependências, então desmarcar o switch disparava o efeito de novo e ele forçava `true` de volta, sem indicar ao usuário por quê.

**Decisão de produto confirmada com o time:** manter o comportamento automático e travado para 60+ (não permitir opt-out manual), só corrigindo a UX.

**Correção aplicada:**
- `frontend/src/components/users/utils.ts`: novo helper `isAgeSixtyOrMore`.
- `frontend/src/components/users/UserForm.tsx`: o `useEffect` agora depende de `isSixtyOrOlder` (não mais de `values.preferential`) e só força `true` quando o valor atual ainda não é `true`. O checkbox fica `disabled` para 60+, com o texto de ajuda explicando que a marcação é automática e bloqueada.

### 3. ~~Resolução do caminho padrão do SQLite podia trocar de banco silenciosamente~~ — corrigido (médio)

`backend/app/database.py` prefere um `app.db` na raiz do repo (se existir) em vez de `backend/app.db`, sem log de qual caminho foi escolhido. Confirmado que esse comportamento é compatível com o fluxo documentado (`uvicorn ... --app-dir backend` executado a partir da raiz do repo), então a lógica de resolução **não foi alterada** — trocar o critério poderia fazer a app "perder" o banco com dados reais que já existe na raiz.

**Correção aplicada:** `_default_sqlite_url()` agora loga (via `logging`, nível `warning`) o caminho absoluto escolhido e se o `app.db` da raiz foi encontrado, deixando a decisão visível no startup em vez de silenciosa.

### 4. ~~`_ensure_scanlog_table` rodava em toda leitura/gravação de scan~~ — corrigido (baixo, performance)

`backend/app/main.py` chamava `_ensure_scanlog_table()` (PRAGMA table_info + possível ALTER TABLE) em pelo menos 6 pontos, duas vezes por leitura de QR no kiosk.

**Correção aplicada:** adicionada flag de módulo `_scanlog_table_ensured`; a checagem de schema roda apenas uma vez por processo.

### 5. ~~Conclusão de exame/entrevista nunca avançava o ciclo de passes~~ — corrigido (alto)

Investigação do teste `test_sequence_completion_advances_stage`, que falhava com `assert 1 == 2` (só 1 ciclo, esperava 2). A causa raiz não era o teste em si, e sim uma lacuna real no backend:

- Desde o commit `3b5d75a` (12/nov/2025), ao completar as 4 presenças de um ciclo, o backend **para de criar o próximo ciclo automaticamente** — em vez disso fecha o ciclo (`status="Concluído"`, `requires_interview=True`) e deixa o avanço de estágio para depois da entrevista/exame. Isso é intencional (ver commit message e o roteiro do README, passo 6: "Ao concluir ciclo/entrevista, o próximo ciclo é preparado").
- O problema: **nenhum código realmente disparava esse avanço no caminho normal.** `PUT /users/{id}/exam` (a única ação de "Salvar" na ficha de exame, que sempre envia `completed: true` — ver `UserExamPage.tsx:224`) só gravava a ficha; nunca setava `PassCycle.interview_completed_at` nem criava o próximo ciclo. O único lugar que fazia isso era o fallback de 2 faltas consecutivas à entrevista (`main.py::_auto_handle_interview_no_show`), pensado como rede de segurança, não como fluxo principal. Resultado: um assistido que **compareceu e teve a ficha preenchida normalmente** ficava com o ciclo parado para sempre — só avançava se depois faltasse 2 vezes à entrevista. O frontend já esperava esse campo populado (`UserExamPage.tsx:242`, `c.interview_completed_at ?? c.completed_at ...`), confirmando que a integração ficou pela metade.
- O teste antigo testava o comportamento anterior ao commit `3b5d75a` (avanço automático na 4ª presença) e estava desatualizado desde então; a falha real (ciclo nunca avança no fluxo normal) não tinha nenhuma cobertura de teste.

**Correção aplicada:** `backend/app/crud.py` ganhou `_complete_pending_interview`, chamada ao final de `create_exam_record`/`update_exam_record`: se a ficha for salva com `completed=True` e existir um ciclo `Concluído`/`requires_interview=True`/`interview_completed_at=None` para o usuário, marca `interview_completed_at` e cria o próximo ciclo (usa `exam.next_pass_type` quando informado; senão segue a sequência padrão de passes). Idempotente — resalvar uma ficha já concluída não cria ciclo duplicado, pois o cycle já não bate no filtro. `test_passes.py::test_sequence_completion_advances_stage` foi atualizado para exercitar o fluxo real (4 presenças → 1 ciclo concluído aguardando entrevista → `PUT /exam` → 2º ciclo ativo no próximo estágio), e validado também contra a aplicação rodando de verdade (incluindo idempotência ao resalvar a ficha).

### 6. ~~Proxy do Vite dev server quebrava rotas do React que colidem com prefixos de API~~ — corrigido (baixo, só ambiente de dev)

`frontend/vite.config.ts` tinha `proxy: { '/users': BACKEND_URL, ... }`. Como o React Router também tem rotas sob `/users` (`/users`, `/users/:id/edit`, `/users/:id/passes`, `/users/:id/exam`...), qualquer navegação de página inteira para essas rotas — digitar a URL, abrir em nova aba, ou dar F5 — era interceptada pelo proxy do Vite e respondida com o JSON cru do backend (`{"detail":"Not Found"}`) em vez do app React. Só funcionava navegando por cliques dentro do SPA (roteamento client-side, sem full navigation). Encontrado ao validar o item 5 no navegador.

**Correção aplicada:** os entries do proxy que colidem com rotas do frontend (`/users`, `/passes`, `/auth`, `/public`, `/openapi.json`) agora usam um `bypass` que checa o header `Accept` da requisição: se contém `text/html` (como uma navegação de navegador envia, mas chamadas `axios`/`fetch` da própria app não), a requisição não é proxyada e cai no fallback do Vite, que serve o `index.html` do React normalmente. `/docs` (Swagger UI do FastAPI, pensado pra ser aberto direto no navegador) continua com proxy simples, sem bypass. Validado com Playwright: navegação direta e F5 em `/users/9/passes` agora renderizam o app corretamente; `/docs` e chamadas de API (`Accept: application/json`) continuam indo pro backend.

### 7. Recepção agora pode cadastrar novos assistidos (feature, a pedido)

Antes, `POST /users` só aceitava `admin` (`require_roles(["admin"])`, gated por `PROTECT_USER_ADMIN_ROUTES`), e as rotas `/users/new` (frontend) e o link "Novo cadastro" no menu só apareciam pra admin.

**Alteração aplicada:**
- `backend/app/main.py:140-155` — `create_user` agora aceita `["admin", "recepcao"]`. Quando quem chama não tem `admin` na lista de papéis do token, o servidor força `user_in.role = "user"` e `user_in.extra_roles = []` **antes** de persistir, ignorando qualquer tentativa de elevação de privilégio enviada no payload (ex.: `role: "admin"`). Testado em `backend/app/tests/test_users.py::test_recepcao_can_create_user_but_cannot_elevate_role` e `::test_admin_create_user_keeps_requested_role`.
- `frontend/src/App.tsx` — rota `/users/new` libera `recepcao` além de `admin`.
- `frontend/src/components/layout/AppLayout.tsx` — link "Novo cadastro" no menu agora aparece pra `admin` **ou** `recepcao` (separado do link "Assistidos", que continua só-admin).
- `frontend/src/components/users/UserForm.tsx` — os campos "Perfil principal" e "Perfis adicionais" só aparecem no formulário para quem é `admin` (`useAuth()`); quem não é admin nunca vê esses campos, evitando a confusão de escolher um papel que o backend vai silenciosamente ignorar.

Validado via API real (login como `recepcao`, `POST /users` com `role: "admin"` no payload → usuário criado com `role: "user"`) e pelo formulário de verdade no navegador (Playwright): login como recepção, clique em "Novo cadastro", formulário sem campos de perfil, submissão cria o assistido com sucesso.

### Validação executada

Depois de aplicar as correções, a aplicação foi de fato executada (backend + frontend) para validar os itens 1 e 2, não só os testes automatizados:

- Backend subido com `uvicorn` contra um SQLite isolado, populado via `seed_demo_auth` / `seed_pass_data`.
- **Item 1** reproduzido ponta a ponta via API real: `GET /users` (que antes retornava 500 por `ResponseValidationError`/`ProgrammingError` em `extra_roles`), duas chamadas consecutivas a `POST /passes/scan-kiosk` simulando o leitor do kiosk, e um `PUT /users/{id}` omitindo `extra_roles` — todos retornando 200/201 sem erro.
- **Item 2** validado no navegador de verdade (Playwright + Chrome headless): usuário com `birth_date` de 1960 aberto no formulário de edição — o checkbox "Atendimento preferencial" aparece marcado, desabilitado, com o texto "Marcação automática e bloqueada para idade igual ou superior a 60 anos.", sem erros no console.
- Essa execução real pegou uma regressão que os testes automatizados não cobriam: o `field_validator` inicial só tratava `extra_roles` como string CSV e quebrava com `ResponseValidationError` para qualquer usuário com `extra_roles=None` no banco (todos os usuários seed, por exemplo). Corrigido tratando `None` como lista vazia.
- **Item 5** reproduzido e validado via API real: usuário novo, 4 presenças semanais → 1 ciclo `Concluído` aguardando entrevista (`interview_completed_at=null`); `PUT /users/{id}/exam` com `next_pass_type=P3A` → aparece o 2º ciclo (`stage_number=2`, `pass_type=P3A`, `status=Ativo`) e o 1º ganha `interview_completed_at` preenchido; resalvar a ficha depois disso não cria um 3º ciclo (idempotente).

## Próximos passos

- Adicionar teste de regressão que faça duas operações de escrita na mesma sessão após um `get_user`/`update_user`, cobrindo o bug corrigido de `extra_roles`.
- Adicionar teste cobrindo o campo `preferential` travado (disabled) para usuário 60+ no `UserForm`.
- Adicionar teste cobrindo o fallback de 2 faltas consecutivas à entrevista (`_auto_handle_interview_no_show`) interagindo com a conclusão normal da ficha — hoje sem nenhuma cobertura automatizada.
- Considerar expor `interview_completed_at`/estágio atual de forma mais explícita na UI de exame (`UserExamPage`), já que agora é preenchido de fato.
- Ajustes finos no fluxo de aprovação de cadastro público.
- Exportação/relatórios adicionais (CSV/PDF) e indicadores de entrevistas pendentes.
