# Backend — Pentaminós

API REST (FastAPI) que guarda as sessões de jogo, as jogadas e a calibração da câmera.
Recebe os eventos que o serviço de visão (`../visao/`) gera. Ainda **não** tem WebSocket:
ele entra na próxima atividade e vai chamar `app/services.py`.

## Decisões (Atividade 6)

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde roda o backend | **Servidor separado em FastAPI** (Python), fora do Next.js | A visão (OpenCV) já é Python; manter o mesmo idioma evita reescrever as regras e deixa o front só como interface. As rotas de API do Next.js ficariam presas ao ciclo do front e não combinam com uma conexão longa de câmera. |
| Tempo real | **WebSocket nativo do FastAPI**, na próxima atividade | A visão só envia eventos JSON simples para o servidor; não precisa de salas, reconexão automática ou fallback, que são o que o Socket.IO traria. Nativo = menos dependência no front e no back. |
| Banco | **SQLite** no desenvolvimento, **Postgres** em produção, via `DATABASE_URL` | SQLite não exige instalar nada e basta para a demo e os testes; o SQLAlchemy + Alembic deixam trocar para Postgres sem mexer no código. |
| Organização | `routers/` (HTTP) → `services.py` (regras) → `models.py` (tabelas) | As regras não dependem de HTTP, então o WebSocket reaproveita `services.registrar_evento`. |

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
| `POST` | `/sessions/{id}/events` | Registra um evento da visão (`piece_placed` / `piece_removed`) → 201 com a jogada |
| `POST` | `/sessions/{id}/hint` | Conta uma dica usada → sessão atualizada |
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

### `POST /sessions/{id}/events`

Corpo no mesmo formato da seção acima; o campo `session` é opcional (vale o id da URL) e,
se vier, precisa ser igual. Mesmos erros do serviço: `404`, `409` e `422`.

```powershell
curl.exe -X POST localhost:8000/sessions/ID/events -H "Content-Type: application/json" `
     -d '{\"type\":\"piece_placed\",\"piece\":\"F\",\"cells\":[[3,2],[4,2],[4,3],[5,1],[5,2]],\"valid\":true}'
```

### Como contar "dicas usadas"

O jogo ainda não tem dicas, então a regra fica definida aqui para quando tiver: **cada dica mostrada
ao jogador faz o front chamar `POST /sessions/{id}/hint`, e cada chamada soma 1 em `dicas_usadas`**.
Não há limite nem desconto de tempo; só sessões `em_andamento` aceitam (senão `409`). O valor
aparece em `GET /sessions/{id}` e fica guardado depois de `finish`/`abandon`.

## Contrato do WebSocket

Rota: `ws://localhost:8000/ws/sessions/{id}` (`app/routers/ws.py`). Cada sessão é uma sala:
o que um cliente manda é repassado aos **outros** clientes da mesma sala.

- **Visão**: conecta com `?role=vision` (`visao/loop_ao_vivo.py`).
- **Navegador**: conecta sem `role` (tela `/jogar-fisico`, `lib/fisico/fontes.ts`).

Toda mensagem é um objeto JSON com `type`. `ts` é inteiro, epoch em segundos. Se a visão
mandar `session`, ele precisa ser igual ao id da URL; senão o servidor responde `error`.
`grid` é sempre uma lista de 6 listas de 10 casas, cada casa `"."` (vazia), `"?"` (incerta)
ou a letra da peça (`FILNPTUVWXYZ`).

### Da visão para os navegadores

| `type` | Obrigatórios | Opcionais | O que o servidor faz |
|---|---|---|---|
| `board_state` | `session`, `ts`, `grid` | — | Repassa. |
| `piece_placed` / `piece_removed` | `session`, `ts`, `piece`, `cells` (`[[linha, coluna], ...]`), `valid` | — | Grava a jogada (`services.registrar_evento_da_sessao`), acrescenta `sequence` (inteiro) e repassa. Se a gravação falhar, manda `error` só para a visão e **não** repassa. |
| `camera_status` | `session`, `ts`, `status`: `sintetica` \| `conectada` \| `perdida` \| `tabuleiro_detectado` | — | Repassa. |
| `game_won` | `session`, `ts`, `tempo_total_s`, `numero_jogadas` | `grid` | Finaliza a sessão com `grid` como `tabuleiro_final` (`services.finalizar_sessao`), troca `tempo_total_s` e `numero_jogadas` pelos valores do banco e repassa. Sem `grid` válido a finalização falha com `error`. |
| `camera_error` | `session`, `ts` | `detail` (texto) | Repassa. Aceito pelo servidor, mas o `loop_ao_vivo.py` ainda não manda. |
| `paused` / `resumed` | `session`, `ts` | — | Repassa. Aceito pelo servidor, mas o `loop_ao_vivo.py` ainda não manda. |

Qualquer outro `type` vindo da visão recebe `error` (`Evento não reconhecido`).

### Do navegador para a visão

| `type` | Obrigatórios | Opcionais | O que acontece |
|---|---|---|---|
| `pause` / `resume` | — | `session` | O servidor repassa com `session` da URL. O loop para / volta a processar quadros. |
| `stop` | — | `session` | Repassado. O loop encerra. |
| `restart` | — | `session` | Repassado. O loop só registra no log; para reiniciar é preciso nova sessão e novo loop. |

Qualquer outro `type` vindo do navegador recebe `error` (`Comando não permitido para o navegador.`).
Como o repasse vai para todos os outros clientes, um navegador também recebe os comandos de outro
navegador da mesma sala; a tela os ignora.

### Do servidor

| `type` | Obrigatórios | Para quem |
|---|---|---|
| `error` | `detail` (texto) | Só para quem mandou a mensagem recusada. Não tem `session` nem `ts`. |

### Na tela

`lib/fisico/validar.ts` confere cada mensagem contra este contrato (`lib/types/fisico.ts`).
Os comandos repassados são ignorados em silêncio; qualquer outra mensagem fora do contrato é
ignorada com `console.warn`.

## Preparado para o WebSocket

Crie `app/routers/ws.py` com um `APIRouter`, chame `services.registrar_evento(db, mensagem)` a cada
mensagem recebida e inclua o router em `app/main.py`. As funções de serviço não dependem de HTTP.

## Limitações

- Sem autenticação: quem alcança a API pode criar, finalizar e abandonar sessões.
- A visão ainda não envia os eventos sozinha: hoje quem chama `/events` é o cliente (ou o WebSocket, na próxima atividade).
- O jogo ainda não tem dicas; a rota `/hint` está pronta, mas nada a chama até o front implementá-las.
