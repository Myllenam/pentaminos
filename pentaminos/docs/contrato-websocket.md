# Contrato do WebSocket

Rota: `ws://localhost:8000/ws/sessions/{id}` (`backend/app/routers/ws.py`). Cada sessão é uma sala:
o que um cliente manda é repassado aos **outros** clientes da mesma sala.

- **Visão**: conecta com `?role=vision` (`visao/loop_ao_vivo.py`).
- **Navegador**: conecta sem `role` (tela `/jogar-fisico`, `lib/fisico/fontes.ts`).

Toda mensagem é um objeto JSON com `type`. `ts` é inteiro, epoch em segundos. Se a visão
mandar `session`, ele precisa ser igual ao id da URL; senão o servidor responde `error`.
`grid` é sempre uma lista de 6 listas de 10 casas, cada casa `"."` (vazia), `"?"` (incerta)
ou a letra da peça (`FILNPTUVWXYZ`).

## Da visão para os navegadores

| `type` | Obrigatórios | Opcionais | O que o servidor faz |
|---|---|---|---|
| `board_state` | `session`, `ts`, `grid` | — | Repassa. |
| `piece_placed` / `piece_removed` | `session`, `ts`, `piece`, `cells` (`[[linha, coluna], ...]`), `valid` | — | Grava a jogada (`services.registrar_evento_da_sessao`), acrescenta `sequence` (inteiro) e repassa. Se a gravação falhar, manda `error` só para a visão e **não** repassa. |
| `camera_status` | `session`, `ts`, `status`: `sintetica` \| `conectada` \| `perdida` \| `tabuleiro_detectado` | — | Repassa. |
| `game_won` | `session`, `ts`, `tempo_total_s`, `numero_jogadas` | `grid` | Finaliza a sessão com `grid` como `tabuleiro_final` (`services.finalizar_sessao`), troca `tempo_total_s` e `numero_jogadas` pelos valores do banco e repassa. Sem `grid` válido a finalização falha com `error`. |
| `camera_error` | `session`, `ts` | `detail` (texto) | Repassa. Aceito pelo servidor, mas o `loop_ao_vivo.py` ainda não manda. |
| `paused` / `resumed` | `session`, `ts` | — | Repassa. Aceito pelo servidor, mas o `loop_ao_vivo.py` ainda não manda. |

Qualquer outro `type` vindo da visão recebe `error` (`Evento não reconhecido`).

## Do navegador para a visão

| `type` | Obrigatórios | Opcionais | O que acontece |
|---|---|---|---|
| `pause` / `resume` | — | `session` | O servidor repassa com `session` da URL. O loop para / volta a processar quadros. |
| `stop` | — | `session` | Repassado. O loop encerra. |
| `restart` | — | `session` | Repassado. O loop só registra no log; para reiniciar é preciso nova sessão e novo loop. |

Qualquer outro `type` vindo do navegador recebe `error` (`Comando não permitido para o navegador.`).
Como o repasse vai para todos os outros clientes, um navegador também recebe os comandos de outro
navegador da mesma sala; a tela os ignora.

## Do servidor

| `type` | Obrigatórios | Para quem |
|---|---|---|
| `error` | `detail` (texto) | Só para quem mandou a mensagem recusada. Não tem `session` nem `ts`. |

## Na tela

`lib/fisico/validar.ts` confere cada mensagem contra este contrato (`lib/types/fisico.ts`).
Os comandos repassados são ignorados em silêncio; qualquer outra mensagem fora do contrato é
ignorada com `console.warn`.
