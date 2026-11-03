# Backend — Pentaminós

API (FastAPI) das sessões, jogadas e calibração, com o WebSocket do modo físico.

## Como rodar (Windows / PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # opcional; sem ele usa SQLite local
alembic upgrade head        # cria as tabelas
uvicorn app.main:app --reload
```

- API em `http://localhost:8000`; rotas e testes manuais em `http://localhost:8000/docs`.
- Testes: `pytest`.
- Banco: `DATABASE_URL` no `.env` (padrão `sqlite:///./pentaminos.db`; Postgres:
  `postgresql+psycopg://usuario:senha@localhost:5432/pentaminos`, com `pip install "psycopg[binary]"`).
  Depois de trocar, rode `alembic upgrade head` de novo.
- Se o PowerShell bloquear o `Activate.ps1`: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Mensagens do WebSocket: `../docs/contrato-websocket.md`.
