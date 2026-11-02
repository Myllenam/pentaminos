"""Pipeline: quadro da câmera -> mensagens do contrato JSON."""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from config import Config
from estabilizacao import Estabilizador, mudanca_media
from forma import classificar_combinado, classificar_forma
from localizacao import retificar
from validador import ResultadoEstado, diferencas, validar_estado
from visao import INCERTO, VAZIO, Paleta, classificar, cores_das_celulas


@dataclass
class ResultadoQuadro:
    descartado: bool
    motivo: str = ""
    estado: ResultadoEstado | None = None      # preenchido quando um novo estado estabilizou
    mensagens: list[dict] = field(default_factory=list)


class Pipeline:
    def __init__(self, cfg: Config, H: np.ndarray, paleta: Paleta, sessao: str = "local",
                 cores_vazio: np.ndarray | None = None):
        self.cfg, self.H, self.paleta, self.sessao = cfg, H, paleta, sessao
        self.cores_vazio = cores_vazio   # só usado no modo "forma"
        self._estab = Estabilizador(cfg.quadros_estaveis)
        self._anterior: np.ndarray | None = None
        self._estado: ResultadoEstado | None = None

    @property
    def estado_atual(self) -> ResultadoEstado | None:
        return self._estado

    def processar(self, frame: np.ndarray, ts: int | None = None) -> ResultadoQuadro:
        cfg = self.cfg
        topo = retificar(frame, self.H, cfg.largura_px, cfg.altura_px)
        movimento = mudanca_media(topo, self._anterior) if self._anterior is not None else 0.0
        self._anterior = topo

        cores = cores_das_celulas(topo, cfg.linhas, cfg.colunas, cfg.fracao_central)
        if cfg.identificacao == "forma":
            grade = classificar_forma(cores, self.paleta, cfg, self.cores_vazio)
        elif cfg.identificacao == "combinado":
            grade = classificar_combinado(cores, self.paleta, cfg, self.cores_vazio)
        else:
            grade, _ = classificar(cores, self.paleta, cfg.limiar_incerto, cfg.peso_l)
        incertas = sum(linha.count("?") for linha in grade)

        motivo = ""
        if movimento > cfg.limiar_mudanca:
            motivo = f"movimento entre quadros ({movimento:.1f})"
        elif incertas > cfg.max_incertas_mao:
            motivo = f"{incertas} casas incertas"
        if motivo:
            self._estab.atualizar(None)
            return ResultadoQuadro(True, motivo)

        novo = self._estab.atualizar(self._lembrar(grade))
        if novo is None:
            return ResultadoQuadro(False)

        resultado = validar_estado(novo, cfg.pecas, cfg.espelhar)
        ts = int(time.time()) if ts is None else ts
        msgs: list[dict] = [{"type": "board_state", "session": self.sessao, "ts": ts, "grid": novo}]
        for ev in diferencas(self._estado, resultado):
            msgs.append({"type": ev.tipo, "session": self.sessao, "ts": ts, "piece": ev.peca,
                         "cells": [list(c) for c in ev.casas], "valid": ev.valida})
        self._estado = resultado
        return ResultadoQuadro(False, estado=resultado, mensagens=msgs)

    def _lembrar(self, grade: list[list[str]]) -> list[list[str]]:
        """Casa "?" herda a letra publicada se as vizinhas não mudaram."""
        antes = self._estab.publicado
        if antes is None:
            return grade
        nova = [linha[:] for linha in grade]
        linhas, colunas = len(grade), len(grade[0])
        for r in range(linhas):
            for c in range(colunas):
                letra = antes[r][c]
                if grade[r][c] != INCERTO or letra in (VAZIO, INCERTO):
                    continue
                vizinhas = [(r + dr, c + dc) for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
                            if 0 <= r + dr < linhas and 0 <= c + dc < colunas]
                if all(grade[i][j] in (INCERTO, antes[i][j]) for i, j in vizinhas):
                    nova[r][c] = letra
        return nova
