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
python -m unittest discover -s tests -t . -v      # 46 testes, ~30 s
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

## Como usar com o celular

```powershell
python testar_camera.py --fonte 0 --mostrar                        # ou http://IP:4747/video
python localizacao.py --fonte 0                                    # 4 cliques; salva calibracao/homografia.json
```

Ordem dos cliques: superior esquerdo, superior direito, inferior direito, inferior esquerdo, com o
lado maior (10 casas) na horizontal. Refazer sempre que o celular ou o tabuleiro se mexerem.

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


