"""Pipeline: quadro da câmera -> mensagens do contrato JSON."""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from config import Config
from correcao import Correcoes, Duvidas
from estabilizacao import Estabilizador, Votador, mudanca_media
from forma import ler_combinado, ler_forma
from localizacao import retificar
from validador import ResultadoEstado, diferencas, validar_estado
from visao import INCERTO, VAZIO, Paleta, classificar, cores_das_celulas


@dataclass
class ResultadoQuadro:
    descartado: bool
    motivo: str = ""
    estado: ResultadoEstado | None = None      # preenchido quando um novo estado estabilizou
    mensagens: list[dict] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)     # linhas para o log


class Pipeline:
    def __init__(self, cfg: Config, H: np.ndarray, paleta: Paleta, sessao: str = "local",
                 cores_vazio: np.ndarray | None = None):
        self.cfg, self.H, self.paleta, self.sessao = cfg, H, paleta, sessao
        self.cores_vazio = cores_vazio   # só usado no modo "forma"
        self._estab = Estabilizador(cfg.quadros_estaveis)
        self._votos = Votador(cfg.janela_votos)
        self._anterior: np.ndarray | None = None
        self._estado: ResultadoEstado | None = None
        self.correcoes = Correcoes(cfg.quadros_estaveis)
        self._duvidas = Duvidas(cfg.segundos_duvida)
        self._duvidas_enviadas: list[dict] = []
        self._disputadas: set = set()

    @property
    def estado_atual(self) -> ResultadoEstado | None:
        return self._estado

    def atribuir(self, casas, letra) -> str | None:
        """Aplica a peça nomeada; devolve o motivo se recusar."""
        return self.correcoes.atribuir(casas, letra, self.cfg.espelhar)

    def processar(self, frame: np.ndarray, ts: int | None = None,
                  agora: float | None = None) -> ResultadoQuadro:
        cfg = self.cfg
        topo = retificar(frame, self.H, cfg.largura_px, cfg.altura_px)
        movimento = mudanca_media(topo, self._anterior) if self._anterior is not None else 0.0
        self._anterior = topo

        cores = cores_das_celulas(topo, cfg.linhas, cfg.colunas, cfg.fracao_central)
        fixas = dict(self.correcoes.pecas)
        disputadas: set = set()
        if cfg.identificacao == "forma":
            grade, disputadas = ler_forma(cores, self.paleta, cfg, self.cores_vazio, fixas)
        elif cfg.identificacao == "combinado":
            grade, disputadas = ler_combinado(cores, self.paleta, cfg, self.cores_vazio, fixas)
        else:
            grade, _ = classificar(cores, self.paleta, cfg.limiar_incerto, cfg.peso_l)
        # Mão = cor fora da paleta; os "?" de quem não chuta não contam.
        por_cor = grade if cfg.identificacao == "cor" else \
            classificar(cores, self.paleta, cfg.limiar_incerto, cfg.peso_l)[0]
        incertas = sum(linha.count("?") for linha in por_cor)

        motivo = ""
        if movimento > cfg.limiar_mudanca:
            motivo = f"movimento entre quadros ({movimento:.1f})"
        elif incertas > cfg.max_incertas_mao:
            motivo = f"{incertas} casas incertas"
        if motivo:
            self._estab.atualizar(None)
            return ResultadoQuadro(True, motivo)

        grade, descartadas = self.correcoes.aplicar(grade)
        avisos = [f"correção de {l} descartada: casas vazias" for l in descartadas]
        self._disputadas = disputadas
        votada = self._votos.votar(self._lembrar(grade), self._estab.publicado)
        novo = self._estab.atualizar(votada)
        ts = int(time.time()) if ts is None else ts
        agora = time.monotonic() if agora is None else agora
        if novo is None:
            if self._estado is None:
                return ResultadoQuadro(False, avisos=avisos)
            duvidas = self._perguntas(self._estado, [list(l) for l in self._estab.publicado], cores, agora)
            if duvidas == self._duvidas_enviadas:
                return ResultadoQuadro(False, avisos=avisos)
            self._duvidas_enviadas = duvidas
            publicada = [list(l) for l in self._estab.publicado]
            return ResultadoQuadro(False, avisos=avisos, mensagens=[self._board_state(ts, publicada, duvidas)])

        resultado = validar_estado(novo, cfg.pecas, cfg.espelhar)
        self._duvidas_enviadas = self._perguntas(resultado, novo, cores, agora)
        msgs: list[dict] = [self._board_state(ts, novo, self._duvidas_enviadas)]
        for ev in diferencas(self._estado, resultado):
            msg = {"type": ev.tipo, "session": self.sessao, "ts": ts, "piece": ev.peca,
                   "cells": [list(c) for c in ev.casas], "valid": ev.valida}
            if ev.tipo == "piece_placed" and set(ev.casas) == set(self.correcoes.pecas.get(ev.peca, ())):
                msg["manual"] = True
            msgs.append(msg)
        self._estado = resultado
        return ResultadoQuadro(False, estado=resultado, mensagens=msgs, avisos=avisos)

    def _perguntas(self, estado: ResultadoEstado, grade, cores, agora: float) -> list[dict]:
        return self._duvidas.atualizar(estado, grade, self._disputadas, cores, self.paleta, self.cfg, agora)

    def _board_state(self, ts: int, grade, duvidas: list[dict]) -> dict:
        msg = {"type": "board_state", "session": self.sessao, "ts": ts, "grid": grade}
        if duvidas:
            msg["duvidas"] = duvidas
        return msg

    def _lembrar(self, grade: list[list[str]]) -> list[list[str]]:
        """Casa "?" herda a letra publicada."""
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
