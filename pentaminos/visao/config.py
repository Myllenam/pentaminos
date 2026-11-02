from __future__ import annotations

import json
from dataclasses import dataclass, field, fields, replace
from pathlib import Path

from pentaminos import LETRAS


@dataclass(frozen=True)
class Config:
    # --- tabuleiro (igual ao modo digital: 6x10, 12 peças) ---
    linhas: int = 6
    colunas: int = 10
    pecas: tuple[str, ...] = LETRAS
    espelhar: bool = True            # modo físico aceita as 8 orientações
    # --- imagem retificada ---
    px_por_casa: int = 100           # 600 x 1000 px no 6x10
    fracao_central: float = 0.6      # recorte central de cada casa
    # --- classificação ---
    peso_l: float = 0.5              # peso da luminosidade (L) na distância Lab; a, b valem 1
    limiar_incerto: float = 16.0     # distância Lab ponderada máx. até a cor mais próxima
    identificacao: str = "cor"       # "cor" (paleta casa a casa) ou "forma" (grupos + forma da peça)
    # --- modo "forma" (ver comparacao_modos.md) ---
    limiar_ocupada: float = 26.0     # distância até a casa vazia que separa vazia de ocupada
    margem_ocupada: float = 4.0      # faixa em volta do limiar_ocupada que vira "?"
    limiar_mesma_peca: float = 16.0  # distância máx. entre vizinhas para ficarem no mesmo grupo
    max_divisoes: int = 200          # divisões de um grupo grande examinadas (Algoritmo X)
    # --- estabilização / oclusão ---
    quadros_estaveis: int = 3        # quadros consecutivos iguais para publicar
    max_incertas: int = 3            # casas incertas toleradas num quadro (mão/sombra passam disso)
    limiar_mudanca: float = 8.0      # (AJUSTAR) diferença média entre quadros (0-255)
    # --- captura ---
    fonte_camera: str = "0"          # índice da webcam ou URL do app de celular
    fps_alvo: int = 10
    # --- arquivos ---
    arquivo_homografia: str = "calibracao/homografia.json"
    arquivo_paleta: str = "calibracao/paleta.json"
    arquivo_vazio: str = "calibracao/vazio.json"   # cor de cada casa vazia (python forma.py FOTO)

    def __post_init__(self):
        if self.identificacao not in ("cor", "forma"):
            raise ValueError(f"identificacao deve ser 'cor' ou 'forma', não {self.identificacao!r}")

    @property
    def largura_px(self) -> int:
        return self.colunas * self.px_por_casa

    @property
    def altura_px(self) -> int:
        return self.linhas * self.px_por_casa


def carregar_config(caminho: str | Path | None = None) -> Config:
    cfg = Config()
    if caminho is None:
        return cfg
    dados = json.loads(Path(caminho).read_text(encoding="utf-8"))
    validos = {f.name for f in fields(Config)}
    desconhecidos = set(dados) - validos
    if desconhecidos:
        raise ValueError(f"Campos desconhecidos no config: {sorted(desconhecidos)}")
    if "pecas" in dados:
        dados["pecas"] = tuple(dados["pecas"])
    return replace(cfg, **dados)
