"""Gera e conta soluções do pentaminó.

(1) testar o validador com tabuleiros completos corretos;
(2) conferir o número de soluções citado na especificação (2.339 no 6x10, contando espelhamento e módulo simetrias do tabuleiro);
(3) saber quantas soluções existem com a regra do jogo digital (só rotação).

Uso:
  python gerar_solucoes.py --contar                    # 6x10 com espelhamento
  python gerar_solucoes.py --contar --sem-espelhamento # 6x10 só rotação
  python gerar_solucoes.py --primeiras 3               # imprime 3 soluções
"""
from __future__ import annotations

import argparse
import time
from typing import Iterator

from pentaminos import LETRAS, orientacoes


def _montar(linhas: int, colunas: int, espelhar: bool, reduzir: bool):
    fator = 1
    restricao_x = None
    if reduzir and linhas % 2 == 0 and colunas % 2 == 0 and linhas != colunas:
        if espelhar:
            # grupo de simetrias válido: identidade, rot. 180, 2 espelhamentos -> 4
            restricao_x = lambda rc, cc: rc < (linhas - 1) / 2 and cc < (colunas - 1) / 2
            fator = 4
        else:
            # só a rotação de 180 graus preserva a regra "sem espelhar" -> 2
            restricao_x = lambda rc, cc: rc < (linhas - 1) / 2
            fator = 2

    Y: dict[tuple, list] = {}
    for letra in LETRAS:
        for forma in orientacoes(letra, espelhar):
            max_r = max(r for r, _ in forma)
            max_c = max(c for _, c in forma)
            for r0 in range(linhas - max_r):
                for c0 in range(colunas - max_c):
                    if letra == "X" and restricao_x and not restricao_x(r0 + 1, c0 + 1):
                        continue
                    itens = [("p", letra)] + [("c", r0 + r, c0 + c) for r, c in forma]
                    Y[(letra, forma, r0, c0)] = itens

    X: dict[tuple, set] = {("p", letra): set() for letra in LETRAS}
    for r in range(linhas):
        for c in range(colunas):
            X[("c", r, c)] = set()
    for chave, itens in Y.items():
        for item in itens:
            X[item].add(chave)
    return X, Y, fator


def _selecionar(X, Y, chave):
    colunas_removidas = []
    for j in Y[chave]:
        for i in X[j]:
            for k in Y[i]:
                if k != j:
                    X[k].remove(i)
        colunas_removidas.append(X.pop(j))
    return colunas_removidas


def _desselecionar(X, Y, chave, colunas_removidas):
    for j in reversed(Y[chave]):
        X[j] = colunas_removidas.pop()
        for i in X[j]:
            for k in Y[i]:
                if k != j:
                    X[k].add(i)


def _resolver(X, Y, parcial) -> Iterator[list]:
    if not X:
        yield list(parcial)
        return
    c = min(X, key=lambda col: len(X[col]))
    for chave in list(X[c]):
        parcial.append(chave)
        removidas = _selecionar(X, Y, chave)
        yield from _resolver(X, Y, parcial)
        _desselecionar(X, Y, chave, removidas)
        parcial.pop()


def solucoes(linhas: int = 6, colunas: int = 10, espelhar: bool = True,
             reduzir: bool = False) -> Iterator[list[list[str]]]:
    X, Y, _ = _montar(linhas, colunas, espelhar, reduzir)
    for escolhidas in _resolver(X, Y, []):
        grade = [["."] * colunas for _ in range(linhas)]
        for letra, forma, r0, c0 in escolhidas:
            for r, c in forma:
                grade[r0 + r][c0 + c] = letra
        yield grade


def contar(linhas: int = 6, colunas: int = 10, espelhar: bool = True) -> tuple[int, int]:
    X, Y, fator = _montar(linhas, colunas, espelhar, reduzir=True)
    n = sum(1 for _ in _resolver(X, Y, []))
    return n, n * fator


def _formatar(grade) -> str:
    return "\n".join("".join(linha) for linha in grade)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--linhas", type=int, default=6)
    ap.add_argument("--colunas", type=int, default=10)
    ap.add_argument("--sem-espelhamento", action="store_true")
    ap.add_argument("--contar", action="store_true")
    ap.add_argument("--primeiras", type=int, default=0)
    a = ap.parse_args()
    esp = not a.sem_espelhamento
    if a.contar:
        t0 = time.time()
        n, total = contar(a.linhas, a.colunas, esp)
        print(f"{'com' if esp else 'sem'} espelhamento, {a.linhas}x{a.colunas}: "
              f"{n} soluções (simetrias quebradas), {total} no total "
              f"[{time.time() - t0:.1f}s]")
    for i, g in zip(range(a.primeiras), solucoes(a.linhas, a.colunas, esp)):
        print(f"--- solução {i + 1} ---\n{_formatar(g)}")
