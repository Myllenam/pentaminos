# Auditoria do modo físico

Estado da branch `feat/tela-jogo-fisico` com o commit da visão computacional (`51db02c`, da Ana)
e do contrato do WebSocket. Caminhos relativos a `pentaminos/`.

**Legenda:** **Feito** · **Parcial** · **Falta** · **Esquisito** (funciona, mas está estranho
ou frágil). Esta auditoria só lista; nada aqui foi corrigido, exceto o que a tela física
precisava para funcionar (contrato, comandos, remoção da `/fisico`).

**Fontes da especificação:** o documento de requisitos não está no repositório. Os textos
usados abaixo são os do pedido desta tarefa e os que o próprio código cita
(`visao/validador.py:1` cita o RF03). RF02, RF04 e RF05 não têm texto em nenhum dos dois e
ficaram como "não verificável".

**Verificações feitas para esta auditoria** (saídas no PR):
- Teste de ponta a ponta com `uvicorn` + `loop_ao_vivo.py --fonte sintetica` (sessão
  `068638fd1260`) e teste de pause/resume/stop (sessão `742bc3829998`).
- "Sonda" do WebSocket com o `TestClient` do FastAPI, num banco descartável: um cliente
  que conecta com `?role=vision` manda `game_won` com o tabuleiro **vazio**. Resultado:
  `status: vencida | numero_jogadas: 0 | casas preenchidas no tabuleiro_final: 0`. Conectar
  em `/ws/sessions/nao-existe` é aceito; só a gravação de jogada responde
  `Sessão 'nao-existe' não encontrada.`

## 1. Requisitos funcionais

| Item | Status | Evidência | Como resolver |
|---|---|---|---|
| RF01 — corrigir a perspectiva automaticamente | **Parcial** | A homografia vem de 4 cliques do usuário (`visao/localizacao.py:3`, `:66-92`) e o loop só carrega a matriz salva (`visao/loop_ao_vivo.py:52`). Nada detecta o tabuleiro sozinho. | Detectar os 4 cantos (contorno do tabuleiro ou marcadores ArUco nos cantos) e recalcular a homografia quando o tabuleiro mexer. |
| RF02 | Não verificável | Sem texto no repositório nem no pedido. | Colocar o documento de requisitos no repositório (ex.: `docs/requisitos.md`). |
| RF03 — validar o estado do tabuleiro | **Parcial** | A visão valida forma e vitória (`visao/validador.py:43`, `:80`). O servidor não: o `ws.py` finaliza a sessão com o `grid` que chegar (`backend/app/routers/ws.py:46-49`) e `finalizar_sessao` só confere o formato 6×10 (`backend/app/services.py:87-92`, `:115`). A sonda acima venceu com o tabuleiro vazio. | No `game_won`, o servidor confere que o `grid` está cheio e que as 12 peças batem com as jogadas gravadas antes de chamar `finalizar_sessao`; senão responde `error`. |
| RF04 | Não verificável | Sem texto no repositório nem no pedido. | Idem RF02. |
| RF05 | Não verificável | Sem texto no repositório nem no pedido. | Idem RF02. |

## 2. Requisitos não funcionais

| Item | Status | Evidência | Como resolver |
|---|---|---|---|
| Acurácia ≥ 98% | **Falta** | Nos dois tabuleiros calibrados o erro por casa é 0,9% (`visao/calibracao/relatorio_calibracao.md:43`), mas no 3º tabuleiro, que não entrou na calibração, deram 4/12, 3/12 e 10/12 peças certas (`relatorio_calibracao.md:91-93`). O par V–Z troca 6,7% das casas (`:61`). Além disso, o relatório mede casas e a meta fala de reconhecimento, sem definir qual métrica conta. | Definir a métrica (peças certas por foto?), travar exposição/balanço de branco (`:17`) e acionar o Plano B ArUco para V–Z (`:95-100`); medir de novo num tabuleiro fora da calibração. |
| Latência ≤ 10 s | **Falta** | Não há medição no código nem nos documentos (`grep -i "latência\|latency"` sem resultado fora do `.venv`). No teste sintético o loop publica um evento a cada ~0,55 s (`loop.log` do PR), mas isso não inclui câmera real. | Registrar na tela a diferença entre o `ts` da mensagem e a hora de chegada e medir com a câmera do celular. |
| Montagem + calibração ≤ 5 min | **Falta** | Não medido. A calibração exige rodar scripts Python à mão (`visao/localizacao.py:123-126`, `visao/calibrar_fotos.py`). | Cronometrar com alguém de fora do grupo seguindo o `visao/README.md`; a tela de calibração (seção 5) ajuda. |
| Reconexão | **Parcial** | A tela reconecta com espera crescente (`lib/fisico/fontes.ts`, `FonteWebSocket.agendar`). O loop conecta uma vez só (`visao/loop_ao_vivo.py:57`) e termina se o WebSocket cair; se a câmera falhar, tenta `read()` no mesmo objeto para sempre, sem reabrir (`:77-82`). | Envolver o `websockets.connect` num laço com espera e reabrir o `VideoCapture` depois de N falhas. |
| Segurança do WebSocket | **Falta** | Qualquer cliente vira "visão" com `?role=vision` (`backend/app/routers/ws.py:23`); a conexão é aceita sem conferir se a sessão existe ou está em andamento (`:22`). Sem autenticação também no REST (`backend/README.md`, "Limitações"). | Ao conectar, buscar a sessão e recusar se não existir ou não estiver `em_andamento`; dar à visão um token por sessão (ex.: devolvido no `POST /sessions`). |
| Mais de um processo do servidor | **Esquisito** | As salas ficam num dicionário em memória (`backend/app/routers/ws.py:10`); com 2 workers do uvicorn a visão e a tela podem cair em processos diferentes e não se ver. | Documentar "1 worker" ou usar um pub/sub (Redis) para as salas. |

## 3. Contrato de mensagens

O contrato está em `backend/README.md`, seção "Contrato do WebSocket", e é o que
`lib/fisico/validar.ts` confere. No teste de ponta a ponta a tela aceitou as 28 mensagens e
o validador não descartou nenhuma.

| Item | Status | Evidência | Como resolver |
|---|---|---|---|
| `board_state`, `piece_placed/removed`, `camera_status`, `game_won`, `error` | **Feito** | `lib/types/fisico.ts`, `lib/fisico/validar.ts`, testes em `lib/fisico/estado.test.ts`; ponta a ponta no PR. | — |
| "Tabuleiro perdido" | **Falta** | O loop manda `tabuleiro_detectado` em todo quadro lido, sem detectar nada (`visao/loop_ao_vivo.py:85-86`); não existe status de tabuleiro perdido. Com câmera real, a tela nunca avisa que o tabuleiro saiu do quadro. | Depois de detectar o tabuleiro (RF01), mandar um status `tabuleiro_perdido` quando muitos quadros seguidos forem descartados e incluí-lo no contrato. |
| `camera_error`, `paused`, `resumed` | **Esquisito** | Aceitos pelo servidor (`backend/app/routers/ws.py:50`) e pela tela, mas o loop nunca os manda (`grep` em `visao/loop_ao_vivo.py`). | Mandar `paused`/`resumed` do loop ao receber `pause`/`resume` (`:70-71`) e `camera_error` ao falhar a abertura (`:47`), ou tirá-los do contrato. |
| `restart` | **Esquisito** | O loop só escreve no log (`visao/loop_ao_vivo.py:72-73`). O Reiniciar da tela manda `stop` e cria outra sessão com outro id (`app/jogar-fisico/page.tsx:217-226`), então o loop precisa ser iniciado de novo à mão com o id novo. | Ou o loop aceita trocar de sessão (`{"type":"restart","session_nova":…}`), ou a tela diz claramente que é preciso rodar o comando de novo. |
| `tempo_total_s` do loop | **Esquisito** | O loop calcula o tempo (`visao/loop_ao_vivo.py:96`), mas o `ws.py` sobrescreve com o do banco (`backend/app/routers/ws.py:48`). | Tirar o campo do `game_won` do loop ou documentar que é só informativo. |
| Tempo conta antes do jogo e durante a pausa | **Esquisito** | `tempo_total_s` = fim − `iniciada_em` do `POST /sessions` (`backend/app/services.py:82`). No teste de ponta a ponta a sessão nasceu às 02:08:28Z, o primeiro evento veio às 02:08:47Z, e o total foi 25 s: 19 s eram espera pelo loop. O servidor não sabe de pausa, e a tela mostra esse tempo na vitória (`app/jogar-fisico/page.tsx:192`). | Começar a contar no primeiro `board_state` e descontar os intervalos entre `pause` e `resume`, ambos no servidor. |

## 4. Endpoints

| Endpoint | Status | Evidência | Como resolver |
|---|---|---|---|
| `POST /sessions` | **Feito** | Usado por `lib/fisico/api.ts` (`criarSessaoFisica`). | — |
| `GET /sessions/{id}` | **Feito** | Ordem de colocação na vitória (`lib/fisico/api.ts`, `buscarSessao`); ponta a ponta no PR. | — |
| `GET /sessions?modo=fisico&status=vencida&pecas=12` | **Feito** | Ranking físico na vitória (`lib/fisico/api.ts`, `listarRankingFisico`). | — |
| `POST /sessions/{id}/finish` | **Parcial** | Só o modo simulado chama (`app/jogar-fisico/page.tsx:127`); no WebSocket quem finaliza é o `ws.py:47`. | — (ver RF03 para a validação). |
| `POST /sessions/{id}/abandon` | **Feito** | Sair/Reiniciar (`app/jogar-fisico/page.tsx`, `abandonarSePreciso`). | — |
| `POST /sessions/{id}/events` | **Esquisito** | Ninguém chama: o loop usa só o WebSocket e o front não usa a rota (`grep "/events"` em `visao/`, `lib/`, `app/`, `components/` sem resultado). É um segundo caminho para gravar jogadas. | Manter só para testes/depuração e dizer isso no README, ou remover. |
| `POST /sessions/{id}/hint` | **Falta** (uso) | A rota existe (`backend/app/routers/sessions.py`, `usar_dica`), mas o jogo não tem dicas (`grep -rn "hint" app components lib` sem resultado); o README já avisa ("Como contar dicas usadas"). | Implementar dicas na tela ou tirar a rota até lá. |
| `POST /calibration`, `GET /calibration/latest` | **Falta** (uso) | Nada envia ou lê calibração do backend: `visao/calibrar_fotos.py` grava `visao/calibracao/*.json` e o loop lê esses arquivos (`visao/loop_ao_vivo.py:48-52`). | Fazer a calibração salvar no backend e o loop ler de lá (ou da tela de calibração). |
| `WS /ws/sessions/{id}` | **Parcial** | Funciona (ponta a ponta no PR), mas tem os problemas da seção 2 e nenhum teste automatizado (`grep -rln websocket backend/tests` vazio). | Testes com `TestClient.websocket_connect` para repasse, gravação, `error` e finalização. |

## 5. Telas

As 4 telas consideradas são as do pedido: jogo físico, conexão e calibração, resultado
completo e histórico com filtro por modo.

| Tela | Status | Evidência | Como resolver |
|---|---|---|---|
| Jogo físico (`/jogar-fisico`) | **Feito** | `app/jogar-fisico/page.tsx`: espelho do tabuleiro, câmera, eventos, erros, pausa, comandos do loop; ponta a ponta no PR. | — |
| Conexão e calibração | **Falta** | Não há rota (`app/` só tem `jogar`, `jogar-fisico`, `teste-worker` e a inicial). A calibração é feita por scripts (`visao/localizacao.py`, `visao/calibrar_fotos.py`). | Tela que mostra o quadro da câmera, recebe os 4 cliques e salva em `POST /calibration`. |
| Resultado completo | **Parcial** | Só o diálogo de vitória: tempo, jogadas, ordem e ranking (`app/jogar-fisico/page.tsx`, `Dialog` de vitória). Não mostra o tabuleiro final salvo nem existe uma página por sessão. | Página `/resultado/{id}` a partir de `GET /sessions/{id}`. |
| Histórico com filtro por modo | **Falta** | O ranking da tela inicial lê só o `localStorage` do modo digital (`lib/ranking.ts:71`, usado em `components/game-setup/game-setup.tsx:213`); partidas físicas não aparecem lá. | Histórico a partir de `GET /sessions?modo=…`, com filtro digital/físico. |

## 6. Código e repositório

| Item | Status | Evidência | Como resolver |
|---|---|---|---|
| Tela física duplicada | **Feito** | `app/fisico/page.tsx` removida no commit `3198c88`; nenhuma referência sobrou (`pnpm build` lista só `/jogar-fisico`). | — |
| Fotos no git | **Esquisito** | `visao/fotos-pentaminos/`: 52 arquivos, 6,2 MB (`du -sh`), 3 com nome `WhatsApp Image 2026-10-29 at …` (`git ls-files`); sem `.gitattributes`, então sem Git LFS. | Renomear as 3 fotos (ex.: `tabuleiro_3_*.jpeg`) e, se o conjunto crescer, mover para Git LFS ou para um release. |
| `saida.txt` versionado | **Esquisito** | `git ls-files saida.txt`: arquivo de saída de script (avaliação experimental), em UTF-16. | Tirar do git e gerar sob demanda (ou salvar em UTF-8 em `docs/`). |
| Rota de teste em produção | **Esquisito** | `app/teste-worker/page.tsx` aparece no `pnpm build` como `/teste-worker`. | Mover para um teste ou proteger por variável de ambiente. |
| `ws.py` difícil de ler | **Esquisito** | Vários comandos por linha com `;` e `try:` de uma linha (`backend/app/routers/ws.py:22`, `:28-29`, `:36-37`, `:55`), diferente do resto do backend. | Reformatar no estilo de `services.py` ao escrever os testes. |
| `loop_ao_vivo.py` | **Esquisito** | Imports não usados `Config` (`:8`) e `colocar_peca` (`:11`); `localizacao` importado em duas linhas (`:9`, `:13`); condição redundante `in ('piece_placed','piece_removed') and =='piece_placed'` (`:94`). | Limpar ao mexer no loop (reconexão). |
| Teste do loop | **Esquisito** | `visao/tests/test_loop_ao_vivo.py:6-24` só testa a `FonteSintetica` (formato e ciclo dos quadros); nada testa o envio pelo WebSocket nem os comandos. | Teste com um servidor `websockets` local que confere as mensagens e o `stop`. |
| Comentários desatualizados | **Esquisito** | `backend/README.md:4-5` e `:12` ("ainda não tem WebSocket", "na próxima atividade"), `:175-177` ("Preparado para o WebSocket"), `:183`. | Atualizar para dizer que o WebSocket existe e apontar para a seção do contrato. |
| Simulação automática na tela | **Esquisito** | Se o WebSocket não abrir em 5 s, a tela passa sozinha para a partida de demonstração (`lib/hooks/useJogoFisico.ts:15`). Há um aviso, mas um backend fora do ar pode passar despercebido numa apresentação. | Pedir confirmação antes de cair no simulado. |
