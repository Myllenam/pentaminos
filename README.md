# Pentaminós

Jogo de pentaminós no tabuleiro 6×10, em dois modos: digital, no navegador, e físico, com uma câmera lendo o tabuleiro real.

| Pasta | O que é | Tecnologia |
|---|---|---|
| [`pentaminos/`](pentaminos/README.md) | Front | Next.js |
| [`pentaminos/backend/`](pentaminos/backend/README.md) | API, banco e WebSocket | FastAPI |
| [`pentaminos/visao/`](pentaminos/visao/README.md) | Leitura da câmera | Python, OpenCV |

## Como rodar

Precisa de Node, pnpm e Python. Use um terminal para cada parte, a partir da raiz do repositório.

**1. Backend** (http://localhost:8000)

```powershell
cd pentaminos\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

**2. Front** (http://localhost:3000)

```powershell
cd pentaminos
pnpm install
pnpm dev
```

**3. Visão** (só no modo físico)

Comece a partida física na tela, que mostra o ID da sessão, e rode:

```powershell
cd pentaminos\visao
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python loop_ao_vivo.py --fonte sintetica --sessao ID_DA_SESSAO
```

`--fonte sintetica` joga uma partida simulada, sem câmera. Para usar a câmera, veja o [README da visão](pentaminos/visao/README.md).
