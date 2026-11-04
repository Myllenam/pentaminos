# Backend — Pentaminós

API (FastAPI) de sessões, jogadas e calibração, com o WebSocket do modo físico.

## Como rodar

```powershell
cd pentaminos\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # opcional; sem ele usa SQLite local
alembic upgrade head        # cria as tabelas
uvicorn app.main:app --reload
```

- **API:** http://localhost:8000, com as rotas em http://localhost:8000/docs.
- **Testes:** `pytest`.
- **Postgres:** instale `psycopg[binary]`, ajuste o `DATABASE_URL` no `.env` e rode `alembic upgrade head` de novo.
- **Mensagens do WebSocket:** tipos em `../lib/types/fisico.ts`.
- Se o PowerShell bloquear o `Activate.ps1`: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
