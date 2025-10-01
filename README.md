# Sistema de Cadastro de Usuários

Este repositório inicia o desenvolvimento do sistema de cadastro de usuários solicitado. A primeira etapa implementada cobre o **item 1** dos requisitos funcionais: API para criação, listagem, atualização e remoção de usuários.

## Estrutura

- `backend/requirements.txt` — dependências Python.
- `backend/app` — código da API FastAPI com SQLAlchemy e SQLite.
- `backend/app/tests` — testes automatizados com Pytest.

## Executando localmente

1. Crie e ative um ambiente virtual.
2. Instale as dependências:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Inicie o servidor:
   ```bash
   uvicorn app.main:app --reload --app-dir backend
   ```
   A API ficará disponível em `http://127.0.0.1:8000`.

## Testes

```bash
pytest backend/app/tests
```

### Módulo de passes

- O painel administrativo agora possui a rota `/users/:id/passes`, onde é possível acompanhar a sequência de passes de cada assistido, registrar presenças/ausências e visualizar o histórico completo.
- Cadastro de assistidos passou a contar com o campo "Dia de assistência", usado futuramente para automatizar faltas.
- No frontend utilize `npm run dev` e acesse a listagem de assistidos; em cada linha há o atalho "Controle de passes".
- Testes do frontend podem ser executados com `npm run test`. Em ambientes sem suporte a *workers* (`tinypool`), rode localmente para validar.
- Para popular o ambiente com dados de exemplo (incluindo presenças, faltas e entrevistas agendadas), execute `python -m backend.scripts.seed_pass_data` antes de iniciar o frontend.
- Ficha de exames disponível via botão na listagem de assistidos, com campos para respostas, observações, recomendações rápidas e impressão.
- Os estágios do ciclo de passes seguem a sequência `P1`, `P2`, `P3A`, `P3B`, `CH`, `P4A`, `P4B`, e cada sessão agora é marcada apenas como **Presente** ou **Ausente**. Ausências são registradas automaticamente no dia seguinte quando o QR code não é lido, sem impedir o registro manual.
- Próximos passos sugeridos: integração com QR code para leitura de presença e criação de indicadores de entrevistas pendentes.
