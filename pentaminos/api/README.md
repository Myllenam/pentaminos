# API do ranking — Pentaminós

Guarda os resultados das partidas: tempo, movimentos, modo (digital/físico),
ordem de colocação e tabuleiro final. Feita com FastAPI e SQLAlchemy.
Usa SQLite por padrão e Postgres trocando só a `DATABASE_URL`.

## Instalação (Windows / PowerShell)

```powershell
cd api
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m unittest discover -s tests -t . -v      # 8 testes
uvicorn main:app --reload                         # http://localhost:8000
```

A documentação interativa fica em `http://localhost:8000/docs`.

## Ligar o frontend à API

Crie `pentaminos/.env.local` com:

```
NEXT_PUBLIC_RANKING_API_URL=http://localhost:8000
```

Reinicie o `pnpm dev`. Sem essa variável, o jogo continua usando o localStorage.

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./pentaminos.db` | Banco. Postgres: `postgresql+psycopg://usuario:senha@host:5432/pentaminos` (instale `psycopg[binary]`). |
| `CORS_ORIGINS` | `http://localhost:3000` | Origens do frontend autorizadas, separadas por vírgula. |

## Rotas

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/ranking?pieces=6&mode=digital&sortBy=time` | Lista os resultados. Todos os filtros são opcionais; `sortBy` é `time` ou `moves`. |
| `POST` | `/ranking` | Salva um resultado e devolve com `id` (201). Recusa `autoSolved: true` (422). |
| `DELETE` | `/ranking` | Apaga todos os resultados (204). |

O JSON usa camelCase, igual ao tipo `RankingEntry` de `lib/ranking.ts`:

```json
{
  "player": "Ana",
  "time": "01:30",
  "pieces": 6,
  "moves": 9,
  "date": "27/10",
  "mode": "digital",
  "placements": [{ "order": 1, "shapeId": "I", "rotation": 90, "origin": [0, 0] }],
  "finalBoard": [["I", "I", null]]
}
```

## Arquivos

| Arquivo | O que faz |
|---|---|
| `main.py` | App FastAPI, CORS e as três rotas. |
| `schemas.py` | Validação do JSON (Pydantic, camelCase). |
| `models.py` | Tabela `ranking`. |
| `database.py` | Engine e sessão do SQLAlchemy. |
| `config.py` | Leitura das variáveis de ambiente. |

## Limitações conhecidas

- Não há autenticação: qualquer um que alcance a API pode gravar ou apagar o ranking.
- As tabelas são criadas na inicialização (`create_all`). Mudanças de esquema ainda
  precisam de migração manual; o próximo passo seria adotar o Alembic.
