"""Imagens sintéticas para testar o pipeline SEM o kit físico.

Renderiza uma grade de letras como tabuleiro colorido, projeta em perspectiva
(como se a câmera estivesse levemente inclinada), e adiciona ruído e uma "mão".
Valida a lógica do código; NÃO valida a acurácia com luz e peças reais.
"""
from __future__ import annotations

import cv2
import numpy as np

CORES_APP = {
    "X": "#ef4444", "W": "#64748b", "V": "#eab308", "Y": "#22c55e",
    "L": "#f97316", "U": "#a855f7", "F": "#06b6d4", "I": "#3b82f6",
    "N": "#ec4899", "P": "#14b8a6", "T": "#8b5cf6", "Z": "#f43f5e",
}
FUNDO_MDF = "#c8a97e"
TAMANHO_QUADRO = (1280, 960)   # (largura, altura) da "câmera"
# onde os 4 cantos do tabuleiro aparecem no quadro: sup.esq, sup.dir, inf.dir, inf.esq
CANTOS_PADRAO = [(230.0, 140.0), (1040.0, 180.0), (1000.0, 790.0), (260.0, 740.0)]


def _bgr(cor_hex: str) -> tuple[int, int, int]:
    return tuple(int(cor_hex[i:i + 2], 16) for i in (5, 3, 1))  # type: ignore[return-value]


def grade_vazia(linhas: int = 6, colunas: int = 10) -> list[list[str]]:
    return [["."] * colunas for _ in range(linhas)]


def colocar_peca(grade, letra: str, forma, r0: int, c0: int) -> list[list[str]]:
    nova = [list(l) for l in grade]
    for r, c in forma:
        nova[r0 + r][c0 + c] = letra
    return nova


def renderizar(grade, px: int = 100, cores: dict[str, str] | None = None,
               fundo: str = FUNDO_MDF) -> np.ndarray:
    """Vista de topo ideal: cada casa é um quadrado de cor uniforme."""
    cores = cores or CORES_APP
    linhas, colunas = len(grade), len(grade[0])
    img = np.zeros((linhas * px, colunas * px, 3), dtype=np.uint8)
    for r in range(linhas):
        for c in range(colunas):
            rot = grade[r][c]
            img[r * px:(r + 1) * px, c * px:(c + 1) * px] = _bgr(fundo if rot == "." else cores[rot])
    return img


def projetar(vista_topo: np.ndarray, cantos=CANTOS_PADRAO, tamanho=TAMANHO_QUADRO,
             fundo_cena=(70, 70, 70)) -> np.ndarray:
    h, w = vista_topo.shape[:2]
    origem = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    M = cv2.getPerspectiveTransform(origem, np.float32(cantos))
    return cv2.warpPerspective(vista_topo, M, tamanho, borderMode=cv2.BORDER_CONSTANT,
                               borderValue=fundo_cena)


def com_ruido(img: np.ndarray, sigma: float = 4.0, rng: np.random.Generator | None = None,
              brilho: float = 1.0) -> np.ndarray:
    rng = rng or np.random.default_rng(0)
    saida = img.astype(np.float32) * brilho + rng.normal(0, sigma, img.shape)
    return np.clip(saida, 0, 255).astype(np.uint8)


def com_mao(frame: np.ndarray, x: int, y: int, largura: int = 260, altura: int = 200,
            cor_bgr=(35, 35, 35)) -> np.ndarray:

    saida = frame.copy()
    cv2.rectangle(saida, (x, y), (x + largura, y + altura), cor_bgr, -1)
    return saida
