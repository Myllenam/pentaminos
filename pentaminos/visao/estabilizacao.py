from __future__ import annotations

import cv2
import numpy as np


def mudanca_media(a: np.ndarray, b: np.ndarray) -> float:
    ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    return float(np.mean(cv2.absdiff(ga, gb)))


class Estabilizador:


    def __init__(self, quadros: int = 3):
        if quadros < 1:
            raise ValueError("quadros deve ser >= 1")
        self.quadros = quadros
        self._candidato: tuple | None = None
        self._contagem = 0
        self.publicado: tuple | None = None

    def atualizar(self, grade: list[list[str]] | None) -> list[list[str]] | None:
        if grade is None:
            self._candidato, self._contagem = None, 0
            return None
        atual = tuple(tuple(linha) for linha in grade)
        if atual == self._candidato:
            self._contagem += 1
        else:
            self._candidato, self._contagem = atual, 1
        if self._contagem >= self.quadros and atual != self.publicado:
            self.publicado = atual
            return [list(linha) for linha in atual]
        return None
