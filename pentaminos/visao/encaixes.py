"""Todos os encaixes das 12 peças no 6x10 e a escolha pelo menor custo de cor."""
from __future__ import annotations

import argparse
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from config import Config
from gerar_solucoes import solucoes
from pentaminos import LETRAS
from visao import Paleta, pesos_lab

ARQUIVO = Path(__file__).parent / "calibracao" / "encaixes_6x10.npy"
_cache: dict[str, np.ndarray] = {}


def gerar() -> np.ndarray:
    """Soluções sem simetria do gerar_solucoes, espelhadas nos dois eixos (9.356)."""
    idx = {l: i for i, l in enumerate(LETRAS)}
    base = np.array([[idx[x] for linha in g for x in linha] for g in solucoes(6, 10, True, True)], np.uint8)
    g = base.reshape(-1, 6, 10)
    todas = np.concatenate([g, g[:, ::-1], g[:, :, ::-1], g[:, ::-1, ::-1]]).reshape(-1, 60)
    return np.unique(todas, axis=0)


def carregar(caminho: str | Path = ARQUIVO) -> np.ndarray:
    chave = str(caminho)
    if chave not in _cache:
        _cache[chave] = np.load(caminho)
    return _cache[chave]


@dataclass
class Encaixe:
    grade: list[list[str]]
    folga: float                      # custo do 2º colocado menos o do melhor
    aceito: bool
    discordam: set[tuple[int, int]]   # casas em que o 1º e o 2º diferem, ou longe da cor


def melhor_encaixe(cores: np.ndarray, paleta: Paleta, cfg: Config, fixas: dict | None = None,
                   todos: np.ndarray | None = None) -> Encaixe | None:
    """Encaixe de menor custo de cor; só vale se for claramente melhor que o 2º e combinar com as cores."""
    if cfg.linhas != 6 or cfg.colunas != 10 or tuple(cfg.pecas) != LETRAS \
            or any(l not in paleta.cores for l in LETRAS):
        return None
    T = carregar() if todos is None else todos
    for letra, casas in (fixas or {}).items():
        T = T[np.all([T[:, r * cfg.colunas + c] == LETRAS.index(letra) for r, c in casas], axis=0)]
    if len(T) < 2:
        return None
    refs = np.stack([paleta.cores[l] for l in LETRAS])
    d = np.linalg.norm((cores.reshape(-1, 1, 3) - refs[None]) * pesos_lab(cfg.peso_l), axis=2)
    custo = d[np.arange(60), T].sum(axis=1)
    primeiro, segundo = np.argpartition(custo, 1)[:2]
    if custo[primeiro] > custo[segundo]:
        primeiro, segundo = segundo, primeiro
    folga = float(custo[segundo] - custo[primeiro])
    longe = d[np.arange(60), T[primeiro]] > cfg.limiar_fora_encaixe
    claro = folga >= cfg.margem_encaixe
    duvida = (T[primeiro] != T[segundo]) if not claro else longe
    grade = [[LETRAS[i] for i in T[primeiro, r * 10:(r + 1) * 10]] for r in range(6)]
    return Encaixe(grade, folga, claro and int(longe.sum()) <= cfg.max_fora_encaixe,
                   {(int(i) // 10, int(i) % 10) for i in np.nonzero(duvida)[0]})


if __name__ == "__main__":
    argparse.ArgumentParser(description="Gera calibracao/encaixes_6x10.npy.").parse_args()
    t0 = time.perf_counter()
    T = gerar()
    ARQUIVO.parent.mkdir(parents=True, exist_ok=True)
    np.save(ARQUIVO, T)
    print(f"{len(T)} encaixes em {ARQUIVO} [{time.perf_counter() - t0:.1f}s]")
