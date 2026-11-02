# Serviço de visão — Pentaminós físico (P2)

Lê o tabuleiro 6×10 pela câmera do celular, classifica cada casa pela cor e valida as peças.
Esta etapa cobre as **fases 1 e 3** do plano: ambiente e o código que não depende de fotos reais.
Ainda **não** fala WebSocket nem tem a calibração com fotos reais (fases 4, 5 e integração).

## Instalação (Windows / PowerShell)

```powershell
cd visao
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m unittest discover -s tests -t . -v      # 53 testes, ~30 s
python demo_sintetico.py                          # partida simulada, sem câmera
```

Se o PowerShell bloquear o `Activate.ps1`: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `config.py` | Parâmetros (6×10, 12 peças, espelhar, limiares). Sobrescreva com um JSON. |
| `pentaminos.py` | As 12 peças (mesmas formas do jogo digital), orientações, verificação de forma. |
| `validador.py` | Valida cada peça (5 casas, conectadas, forma certa), detecta vitória, gera eventos. |
| `localizacao.py` | Calibração manual: 4 cliques nos cantos → homografia salva em JSON. |
| `visao.py` | Cor mediana por casa, paleta, classificação por vizinho mais próximo, `construir_paleta`. |
| `estabilizacao.py` | 3 quadros consecutivos iguais; descarta quadros com movimento. |
| `pipeline.py` | Junta tudo: quadro → mensagens `board_state` / `piece_placed` / `piece_removed`. |
| `gerar_solucoes.py` | Gera e conta soluções do 6×10 (Algoritmo X). |
| `sintetico.py` | Imagens de teste (perspectiva, ruído, "mão"). |
| `testar_camera.py` | Fase 1: testa DroidCam/IP Webcam e mede o fps. |
| `calibrar_fotos.py` | Atividade 4: mede as cores nas fotos reais, escolhe espaço de cor e limiar, diz se precisa de ArUco. |
| `calibracao/` | `paleta.json` (medida nas fotos) e `relatorio_calibracao.md` (números e decisões). |

## Como usar com o celular

```powershell
python testar_camera.py --fonte 0 --mostrar                        # ou http://IP:4747/video
python localizacao.py --fonte 0                                    # 4 cliques; salva calibracao/homografia.json
```

Ordem dos cliques: superior esquerdo, superior direito, inferior direito, inferior esquerdo, com o
lado maior (10 casas) na horizontal. Refazer sempre que o celular ou o tabuleiro se mexerem.

## Calibração com fotos reais (Atividade 4)

```powershell
python calibrar_fotos.py --pasta ..\fotos-pentaminos      # gera calibracao/paleta.json e o relatório
```

Resultado (detalhes e tabelas em `calibracao/relatorio_calibracao.md`):

- **Espaço de cor:** Lab com a luminosidade pesando 0,5 (`peso_l`). Erro de 0,9% das casas contra 2,0% (Lab puro),
  2,3% (HSV) e 6,2% (só a, b). Paleta medida com o **tabuleiro montado** (as fotos de peça sozinha dão 7,5%).
- **Limiar:** `limiar_incerto = 16` e `max_incertas = 3`. Quadro com mão ou sombra forte é descartado; quadro normal passa.
- **Pares perigosos:** V–Z (marrons) é o único que não separa por cor (6,7% das casas trocadas); I–T, L–N e U–Y ficam abaixo de 2%.
- **Plano B (ArUco):** acionado só para V e Z. Antes, vale travar a exposição do celular e tentar desempate pela forma da peça.
- **Exposição:** a câmera clareia a foto conforme entram peças (papel de 197 a 225), e as cores sobem junto.
  Travar exposição e balanço de branco no app da câmera é a melhor correção.
- Refaça a paleta no local definitivo, com o tabuleiro cheio e a exposição travada.

## Regras e decisões

- **Orientações:** o modo físico aceita as **8** (rotação + espelho), pois o jogador vira a peça na mão.
  O jogo digital e o documento de requisitos (RN07) continuam só com rotação (4). Em `config.py`,
  `espelhar=False` volta à regra do digital.
- **Soluções do 6×10** (calculadas por `gerar_solucoes.py`):
  com espelhamento **2.339** (9.356 contando simetrias do tabuleiro), o número da especificação;
  só rotação **53** (106 contando a rotação de 180°).
- **Lab em vez de HSV:** a especificação fala em mediana em HSV. Usamos Lab, porque o matiz do HSV
  dá a volta em 0/180 (vermelho) e é instável em cores escuras. Mesma ideia, medida mais robusta.
- **Localização manual** (passo 2 do pipeline). ArUco fica como plano B, por peça, se a cor falhar.



## Atividade 5 — loop ao vivo (câmera ou fonte sintética)

O script `loop_ao_vivo.py` executa o `Pipeline` em aproximadamente 10 FPS e publica os eventos pelo WebSocket do backend. Os quadros descartados e os eventos ficam registrados no terminal.

```powershell
# 1. Inicie o backend (em outro terminal, na pasta backend)
uvicorn app.main:app --reload

# 2. Crie uma sessão física pela tela /fisico ou pela API POST /sessions.
# 3. Dentro de visao, execute o comando que a tela /fisico mostra:
python loop_ao_vivo.py --fonte sintetica --sessao ID_DA_SESSAO

# Câmera USB:
python loop_ao_vivo.py --fonte 0 --sessao ID_DA_SESSAO

# Celular (DroidCam/IP Webcam):
python loop_ao_vivo.py --fonte http://IP_DO_CELULAR:4747/video --sessao ID_DA_SESSAO 
```

Para a câmera real, antes execute `localizacao.py` para salvar a homografia e `calibrar_fotos.py` (ou o procedimento de calibração já documentado) para criar a paleta. A fonte sintética não precisa de câmera, homografia ou paleta reais: usa a paleta e a perspectiva artificiais do módulo `sintetico.py`.

## Atividades 7, 9 e 10 — integração

- O serviço Python conecta em `ws://localhost:8000/ws/sessions/{id}?role=vision`.
- A interface do navegador conecta em `ws://localhost:8000/ws/sessions/{id}`. O backend mantém uma sala por sessão e retransmite `board_state`, `piece_placed`, `piece_removed`, `camera_status` e `game_won`.
- A tela `/fisico` cria uma sessão `modo=fisico`, espelha a grade, mostra status, tempo, peças detectadas/restantes e eventos. Os botões Pausar/Continuar enviam controles ao loop; Reiniciar abandona a sessão atual para iniciar outra.
- Ao receber `game_won`, o backend finaliza a sessão, calcula o tempo, guarda o tabuleiro final e mantém as jogadas ordenadas por sequência. A tela consulta `/sessions?modo=fisico&status=vencida&pecas=12` para exibir o ranking físico.

A tela física mostra o comando para iniciar o processo Python em um segundo terminal. O navegador não inicia processos locais por conta própria.
