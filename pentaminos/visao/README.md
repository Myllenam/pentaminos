# Visão — Pentaminós

Lê o tabuleiro 6×10 pela câmera, identifica as peças e envia os eventos ao backend pelo WebSocket.

## Como rodar

Precisa do [backend](../backend/README.md) no ar e do ID de uma sessão física, que a tela mostra ao começar a partida.

```powershell
cd pentaminos\visao
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

python loop_ao_vivo.py --fonte sintetica --sessao ID_DA_SESSAO               # sem câmera
python loop_ao_vivo.py --fonte 0 --sessao ID_DA_SESSAO                       # webcam
python loop_ao_vivo.py --fonte http://IP_DO_CELULAR:4747/video --sessao ID_DA_SESSAO   # celular
```

**Testes:** `python -m unittest discover -s tests -t .`

## Calibrar a câmera

Refaça a homografia sempre que a câmera ou o tabuleiro se mexerem, e a paleta quando a luz ou o local mudarem.

```powershell
python testar_camera.py --fonte 0 --mostrar                 # testa a câmera
python localizacao.py --fonte 0                             # 4 cliques nos cantos: gera calibracao/homografia.json
python calibrar_fotos.py --pasta fotos-pentaminos           # gera calibracao/paleta.json
python forma.py foto_do_tabuleiro_vazio.jpg                 # opcional: gera calibracao/vazio.json
```

Ordem dos cliques: superior esquerdo, superior direito, inferior direito e inferior esquerdo, com o lado de 10 casas na horizontal.

## Modos de identificação

Em `identificacao`, no `config.py`: `combinado` (padrão), `cor` ou `forma`. Para trocar sem editar o arquivo, passe um JSON em `--config`.

## Peça não reconhecida

- **O que acontece:** a casa sem identificação fica `?`, sem receber a letra de outra peça. Com o tabuleiro cheio, a visão escolhe a solução do 6×10 que mais combina com as cores. Se a dúvida durar 2 s, a tela pergunta ao jogador.
- **O que o jogador faz:** escolhe a letra, ajusta as casas tocando no tabuleiro e confirma. A resposta vale até a peça sair do tabuleiro.
- **Parâmetros (`config.py`):** `segundos_duvida`, `margem_encaixe`, `limiar_fora_encaixe`, `max_fora_encaixe`, `max_incertas_mao`.
