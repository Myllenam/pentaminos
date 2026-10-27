# Backend — Pentaminós

API REST (FastAPI) que guarda as sessões de jogo, as jogadas e a calibração da câmera.
Recebe os eventos que o serviço de visão (`../visao/`) gera. Ainda **não** tem WebSocket:
ele entra na próxima atividade e vai chamar `app/services.py`.

## Instalação (Windows / PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env                            # opcional; sem ele vale SQLite local
alembic upgrade head                              # cria as tabelas
uvicorn app.main:app --reload                     # http://localhost:8000
pytest                                            # testes (SQLite em memória)
```

Documentação interativa (Swagger): `http://localhost:8000/docs`.
Se o PowerShell bloquear o `Activate.ps1`: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Banco de dados

`DATABASE_URL` escolhe o banco. O código não usa nada específico de um dos dois.

| Banco | `DATABASE_URL` |
|---|---|
| SQLite (padrão) | `sqlite:///./pentaminos.db` |
| Postgres | `postgresql+psycopg://usuario:senha@localhost:5432/pentaminos` (instale `psycopg[binary]`) |

Depois de trocar, rode `alembic upgrade head` de novo. Para mudar o modelo:
edite `app/models.py` e rode `alembic revision --autogenerate -m "descrição"`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `app/main.py` | App FastAPI, CORS (`http://localhost:3000`) e conversão de erros em HTTP. |
| `app/config.py` | Lê `DATABASE_URL` e `CORS_ORIGINS` do ambiente / `.env`. |
| `app/db.py` | Engine, sessão e a base dos modelos. |
| `app/models.py` | Tabelas `sessoes`, `jogadas`, `calibracoes`. |
| `app/schemas.py` | Entrada e saída da API (Pydantic). |
| `app/services.py` | Regras de negócio, sem HTTP: `registrar_evento`, `finalizar_sessao`... |
| `app/routers/` | Um arquivo por grupo de rotas. |
| `app/constantes.py` | 6×10, as 12 letras, modos e status. |
| `alembic/` | Migrações (`versions/0001_modelo_inicial.py`). |
| `tests/` | pytest; `fixtures/demo_sintetico.jsonl` é saída real do `visao/demo_sintetico.py`. |

## Modelo de dados

**Sessao** (`sessoes`): `id` (12 hex), `jogador`, `modo` (`digital`|`fisico`), `pecas` (1–12),
`status` (`em_andamento`|`vencida`|`abandonada`), `iniciada_em`, `finalizada_em`, `tempo_total_s`,
`numero_jogadas`, `dicas_usadas`, `tabuleiro_final` (JSON, grade 6×10).

**Jogada** (`jogadas`): `id`, `sessao_id` (FK), `sequencia` (1, 2, 3... por sessão),
`tipo` (`piece_placed`|`piece_removed`), `peca`, `casas` (JSON `[[linha, coluna], ...]`), `valida`, `ts`.

**Calibracao** (`calibracoes`): `id`, `paleta` (JSON `{letra ou ".": [L, a, b]}`),
`homografia` (JSON 3×3, opcional), `criada_em`.

## Endpoints

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/health` | `{"status": "ok"}` |
| `POST` | `/sessions` | Cria sessão `{jogador, modo, pecas}` → 201 |
| `GET` | `/sessions?jogador=&modo=&pecas=&status=` | Lista (filtros opcionais) |
| `GET` | `/sessions/{id}` | Sessão com `jogadas` por `sequencia`; 404 se não existir |
| `POST` | `/sessions/{id}/finish` | `{tabuleiro_final}` → `vencida` + `tempo_total_s` |
| `POST` | `/sessions/{id}/abandon` | → `abandonada` |
| `POST` | `/calibration` | `{paleta, homografia?}` → 201 |
| `GET` | `/calibration/latest` | Última calibração; 404 se não houver |

Erros: `404` não encontrado, `409` sessão que não está `em_andamento`, `422` dado inválido
(corpo `{"detail": "..."}`).

```powershell
curl.exe -X POST localhost:8000/sessions -H "Content-Type: application/json" `
     -d '{\"jogador\":\"Ana\",\"modo\":\"fisico\",\"pecas\":12}'
```

## Eventos da visão (`services.registrar_evento`)

Recebe um dict no formato de `visao/pipeline.py`:

```json
{"type": "piece_placed", "session": "a1b2c3d4e5f6", "ts": 1793141068,
 "piece": "F", "cells": [[3, 2], [4, 2], [4, 3], [5, 1], [5, 2]], "valid": true}
```

Cria a `Jogada` com a próxima `sequencia` e soma 1 em `numero_jogadas` só em `piece_placed`.
Recusa (`DadosInvalidos`): tipo diferente de `piece_placed`/`piece_removed` (inclui `board_state`),
peça fora de `FILNPTUVWXYZ`, casa fora do 6×10, `valid` que não seja booleano.
Recusa com `NaoEncontrado` / `ConflitoDeEstado` se a sessão não existe / não está em andamento.

## Preparado para o WebSocket

Crie `app/routers/ws.py` com um `APIRouter`, chame `services.registrar_evento(db, mensagem)` a cada
mensagem recebida e inclua o router em `app/main.py`. As funções de serviço não dependem de HTTP.

## Limitações

- Sem autenticação: quem alcança a API pode criar, finalizar e abandonar sessões.
- Ainda não há rota REST para registrar jogadas; só o serviço (o WebSocket vai usá-lo).
- `dicas_usadas` existe no modelo, mas nenhuma rota o altera ainda.
