"""
Regra de orientação:
  - espelhar=True  -> 8 orientações possíveis (rotações + espelhos). É a regra do
                      modo tabuleiro físico: o jogador pode virar a peça na mão.
  - espelhar=False -> só as 4 rotações. É a regra do jogo digital e do documento
                      de requisitos (RN07).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Iterable

Celula = tuple[int, int]
Forma = tuple[Celula, ...]

FORMAS_BASE: dict[str, Forma] = {
    "X": ((0, 1), (1, 0), (1, 1), (1, 2), (2, 1)),
    "W": ((0, 0), (1, 0), (1, 1), (2, 1), (2, 2)),
    "V": ((0, 0), (1, 0), (2, 0), (2, 1), (2, 2)),
    "Y": ((0, 1), (1, 0), (1, 1), (2, 1), (3, 1)),
    "L": ((0, 0), (1, 0), (2, 0), (3, 0), (3, 1)),
    "U": ((0, 0), (0, 2), (1, 0), (1, 1), (1, 2)),
    "F": ((0, 1), (0, 2), (1, 0), (1, 1), (2, 1)),
    "I": ((0, 0), (1, 0), (2, 0), (3, 0), (4, 0)),
    "N": ((0, 1), (1, 1), (2, 0), (2, 1), (3, 0)),
    "P": ((0, 0), (0, 1), (1, 0), (1, 1), (2, 0)),
    "T": ((0, 0), (0, 1), (0, 2), (1, 1), (2, 1)),
    "Z": ((0, 0), (0, 1), (1, 1), (2, 1), (2, 2)),
}

LETRAS: tuple[str, ...] = tuple("FILNPTUVWXYZ")


def normalizar(celulas: Iterable[Celula]) -> Forma:
    celulas = list(celulas)
    min_r = min(r for r, _ in celulas)
    min_c = min(c for _, c in celulas)
    return tuple(sorted((r - min_r, c - min_c) for r, c in celulas))


def girar90(celulas: Iterable[Celula]) -> Forma:
    return normalizar((c, -r) for r, c in celulas)


def espelhar_horizontal(celulas: Iterable[Celula]) -> Forma:
    return normalizar((r, -c) for r, c in celulas)


@lru_cache(maxsize=None)
def orientacoes(letra: str, espelhar: bool = True) -> tuple[Forma, ...]:
    base = normalizar(FORMAS_BASE[letra])
    formas: set[Forma] = set()
    pontos_de_partida = [base]
    if espelhar:
        pontos_de_partida.append(espelhar_horizontal(base))
    for atual in pontos_de_partida:
        for _ in range(4):
            formas.add(atual)
            atual = girar90(atual)
    return tuple(sorted(formas))


def conexa(celulas: Iterable[Celula]) -> bool:
    restantes = set(celulas)
    if not restantes:
        return False
    pilha = [next(iter(restantes))]
    visitadas = set(pilha)
    while pilha:
        r, c = pilha.pop()
        for viz in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if viz in restantes and viz not in visitadas:
                visitadas.add(viz)
                pilha.append(viz)
    return len(visitadas) == len(restantes)


def forma_corresponde(letra: str, celulas: Iterable[Celula], espelhar: bool = True) -> bool:
    celulas = list(celulas)
    if len(celulas) != 5 or letra not in FORMAS_BASE:
        return False
    return normalizar(celulas) in set(orientacoes(letra, espelhar))
