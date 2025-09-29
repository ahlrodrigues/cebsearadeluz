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

- O painel administrativo agora possui a rota `/users/:id/passes`, onde é possível acompanhar a sequência de passes de cada assistido, registrar presenças/faltas e visualizar o histórico completo.
- Cadastro de assistidos passou a contar com o campo "Dia de assistência", usado futuramente para automatizar faltas.
- No frontend utilize `npm run dev` e acesse a listagem de assistidos; em cada linha há o atalho "Controle de passes".
- Testes do frontend podem ser executados com `npm run test`. Em ambientes sem suporte a *workers* (`tinypool`), rode localmente para validar.
- Próximos passos sugeridos: integração com QR code para leitura de presença e criação de indicadores de entrevistas pendentes.
