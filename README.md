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
