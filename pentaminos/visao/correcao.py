"""Dúvidas enviadas à tela e correções feitas pelo jogador."""
from __future__ import annotations

import time

import numpy as np

from config import Config
from forma import _componentes, distancia, divisoes
from pentaminos import LETRAS, forma_corresponde
from validador import ResultadoEstado
from visao import INCERTO, VAZIO, Paleta

Celula = tuple[int, int]


def candidatas(casas, faltam: list[str], cores: np.ndarray, paleta: Paleta, cfg: Config) -> list[str]:
    """Letras que faltam e cabem; senão, as 3 mais próximas pela cor."""
    prazo = time.perf_counter() + cfg.tempo_max_forma_ms / 1000
    cabem = {l for d in divisoes(list(casas), cfg.espelhar, cfg.max_divisoes, prazo) for l, _ in d}
    if cabem & set(faltam):
        return sorted(cabem & set(faltam))
    opcoes = [l for l in (faltam or LETRAS) if l in paleta.cores]
    mediana = np.median([cores[r, c] for r, c in casas], axis=0)
    return sorted(opcoes, key=lambda l: float(distancia(mediana, paleta.cores[l], cfg.peso_l)))[:3]


def regioes(estado: ResultadoEstado, grade, disputadas=()) -> list[tuple[Celula, ...]]:
    """Componentes de casas "?", de peças inválidas e de casas em disputa entre encaixes."""
    casas = {(r, c) for r, linha in enumerate(grade) for c, x in enumerate(linha) if x == INCERTO}
    casas |= {c for p in estado.pecas.values() if not p.valida for c in p.casas}
    casas |= set(disputadas)
    return [tuple(r) for r in _componentes(casas)]


class Duvidas:
    """Regiões que seguem iguais há mais de `espera_s` segundos."""

    def __init__(self, espera_s: float):
        self.espera_s = espera_s
        self._desde: dict[tuple, float] = {}

    def atualizar(self, estado: ResultadoEstado, grade, disputadas, cores, paleta: Paleta, cfg: Config,
                  agora: float) -> list[dict]:
        atuais = regioes(estado, grade, disputadas)
        self._desde = {k: self._desde.get(k, agora) for k in atuais}
        faltam = [l for l in cfg.pecas if not (l in estado.pecas and estado.pecas[l].valida)]
        estaveis = [casas for casas in sorted(self._desde) if agora - self._desde[casas] >= self.espera_s]
        return [{"id": f"d{i}", "cells": [list(c) for c in casas],
                 "candidatas": candidatas(casas, faltam, cores, paleta, cfg)}
                for i, casas in enumerate(estaveis, 1)]


class Correcoes:
    """Peças nomeadas pelo jogador, até as casas ficarem vazias."""

    def __init__(self, quadros_vazios: int):
        self.quadros_vazios = quadros_vazios
        self.pecas: dict[str, tuple[Celula, ...]] = {}
        self._vazias: dict[str, int] = {}

    def atribuir(self, casas, letra, espelhar: bool) -> str | None:
        """Guarda a correção; devolve o motivo se ela for recusada."""
        try:
            casas = tuple(sorted((int(r), int(c)) for r, c in casas))
        except (TypeError, ValueError):
            return "casas inválidas"
        if letra not in LETRAS or not forma_corresponde(letra, casas, espelhar):
            return f"as casas não formam a peça {letra}"
        self.pecas = {l: c for l, c in self.pecas.items() if not set(c) & set(casas)}
        self.pecas[letra], self._vazias[letra] = casas, 0
        return None

    def limpar(self) -> None:
        self.pecas.clear()
        self._vazias.clear()

    def aplicar(self, grade: list[list[str]]) -> tuple[list[list[str]], list[str]]:
        """Grade corrigida e letras com correção descartada."""
        nova = [linha[:] for linha in grade]
        descartadas = []
        for letra, casas in list(self.pecas.items()):
            if any(grade[r][c] == VAZIO for r, c in casas):
                self._vazias[letra] += 1
                if self._vazias[letra] >= self.quadros_vazios:
                    del self.pecas[letra], self._vazias[letra]
                    descartadas.append(letra)
                continue
            self._vazias[letra] = 0
            for r, c in casas:
                nova[r][c] = letra
        return nova, descartadas
