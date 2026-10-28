from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

VAZIO = "."
INCERTO = "?"


def bgr_para_lab(img: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(np.asarray(img, dtype=np.float32) / 255.0, cv2.COLOR_BGR2LAB)


def hex_para_lab(cor_hex: str) -> np.ndarray:
    r, g, b = (int(cor_hex[i:i + 2], 16) for i in (1, 3, 5))
    return bgr_para_lab(np.array([[[b, g, r]]], dtype=np.uint8))[0, 0]


def cores_das_celulas(img_retificada: np.ndarray, linhas: int, colunas: int,
                      fracao: float = 0.6) -> np.ndarray:

    lab = bgr_para_lab(img_retificada)
    alt, larg = lab.shape[:2]
    ch, cw = alt / linhas, larg / colunas
    m = (1 - fracao) / 2
    saida = np.zeros((linhas, colunas, 3), dtype=np.float32)
    for r in range(linhas):
        y0, y1 = int(round(r * ch + ch * m)), int(round(r * ch + ch * (1 - m)))
        for c in range(colunas):
            x0, x1 = int(round(c * cw + cw * m)), int(round(c * cw + cw * (1 - m)))
            saida[r, c] = np.median(lab[y0:y1, x0:x1].reshape(-1, 3), axis=0)
    return saida


@dataclass
class Paleta:
    cores: dict[str, np.ndarray]

    @classmethod
    def de_hex(cls, pecas_hex: dict[str, str], fundo_hex: str) -> "Paleta":
        cores = {k: hex_para_lab(v) for k, v in pecas_hex.items()}
        cores[VAZIO] = hex_para_lab(fundo_hex)
        return cls(cores)

    def salvar(self, caminho: str | Path) -> None:
        caminho = Path(caminho)
        caminho.parent.mkdir(parents=True, exist_ok=True)
        caminho.write_text(json.dumps({k: [float(x) for x in v] for k, v in self.cores.items()},
                                      indent=2), encoding="utf-8")

    @classmethod
    def carregar(cls, caminho: str | Path) -> "Paleta":
        d = json.loads(Path(caminho).read_text(encoding="utf-8"))
        return cls({k: np.array(v, dtype=np.float32) for k, v in d.items()})

    def distancias_entre_cores(self) -> list[tuple[float, str, str]]:
        ks = list(self.cores)
        pares = [(float(np.linalg.norm(self.cores[a] - self.cores[b])), a, b)
                 for i, a in enumerate(ks) for b in ks[i + 1:]]
        return sorted(pares)


def classificar(cores_lab: np.ndarray, paleta: Paleta,
                limiar: float) -> tuple[list[list[str]], np.ndarray]:

    rotulos = list(paleta.cores)
    refs = np.stack([paleta.cores[r] for r in rotulos])              
    linhas, colunas = cores_lab.shape[:2]
    d = np.linalg.norm(cores_lab.reshape(-1, 1, 3) - refs[None], axis=2)  
    idx = d.argmin(axis=1)
    dmin = d[np.arange(len(idx)), idx].reshape(linhas, colunas)
    grade = [[INCERTO if dmin[r, c] > limiar else rotulos[idx[r * colunas + c]]
              for c in range(colunas)] for r in range(linhas)]
    return grade, dmin


def construir_paleta(img_vazio: np.ndarray, imagens_pecas: dict[str, np.ndarray],
                     linhas: int, colunas: int, fracao: float = 0.6,
                     limiar_diferenca: float = 12.0) -> Paleta:

    base = cores_das_celulas(img_vazio, linhas, colunas, fracao)
    cores = {VAZIO: np.median(base.reshape(-1, 3), axis=0)}
    for letra, img in imagens_pecas.items():
        atual = cores_das_celulas(img, linhas, colunas, fracao)
        mudou = np.linalg.norm(atual - base, axis=2) > limiar_diferenca
        n = int(mudou.sum())
        if n != 5:
            raise ValueError(
                f"Peça {letra}: {n} casas diferentes do tabuleiro vazio (esperado 5). "
                "Confira se a peça estava sozinha, se a foto é do mesmo enquadramento e "
                "se a cor da peça é distinguível do fundo.")
        cores[letra] = np.median(atual[mudou], axis=0)
    return Paleta(cores)
