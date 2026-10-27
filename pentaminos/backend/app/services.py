"""Regras de negócio, independentes do HTTP.

Os endpoints REST chamam estas funções e o futuro endpoint WebSocket também.
Os erros são exceções de ErroServico; a camada HTTP as converte em resposta
(veja app/main.py).
"""
from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.constantes import COLUNAS, LETRAS, LINHAS, TIPOS_JOGADA, VAZIO
from app.models import Calibracao, Jogada, Sessao, agora


class ErroServico(Exception):
    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class DadosInvalidos(ErroServico):
    status_code = 422


class NaoEncontrado(ErroServico):
    status_code = 404


class ConflitoDeEstado(ErroServico):
    status_code = 409


# --------------------------------------------------------------------------
# Sessões
# --------------------------------------------------------------------------

def criar_sessao(db: Session, jogador: str, modo: str, pecas: int) -> Sessao:
    sessao = Sessao(jogador=jogador, modo=modo, pecas=pecas)
    db.add(sessao)
    db.commit()
    return sessao


def buscar_sessao(db: Session, sessao_id: str) -> Sessao:
    sessao = db.get(Sessao, sessao_id)
    if sessao is None:
        raise NaoEncontrado(f"Sessão {sessao_id!r} não encontrada.")
    return sessao


def listar_sessoes(
    db: Session,
    jogador: str | None = None,
    modo: str | None = None,
    pecas: int | None = None,
    status: str | None = None,
) -> list[Sessao]:
    consulta = select(Sessao)
    if jogador is not None:
        consulta = consulta.where(Sessao.jogador == jogador)
    if modo is not None:
        consulta = consulta.where(Sessao.modo == modo)
    if pecas is not None:
        consulta = consulta.where(Sessao.pecas == pecas)
    if status is not None:
        consulta = consulta.where(Sessao.status == status)
    return list(db.scalars(consulta.order_by(Sessao.iniciada_em.desc(), Sessao.id)))


def _exigir_em_andamento(sessao: Sessao) -> None:
    if sessao.status != "em_andamento":
        raise ConflitoDeEstado(
            f"A sessão {sessao.id!r} já está {sessao.status}; "
            "só sessões em andamento aceitam esta operação."
        )


def _encerrar(db: Session, sessao: Sessao, status: str) -> Sessao:
    fim = agora()
    sessao.status = status
    sessao.finalizada_em = fim
    sessao.tempo_total_s = max(0, int((fim - sessao.iniciada_em).total_seconds()))
    db.commit()
    return sessao


def finalizar_sessao(db: Session, sessao_id: str, tabuleiro_final: Any) -> Sessao:
    """Marca a sessão como vencida e calcula o tempo total."""
    sessao = buscar_sessao(db, sessao_id)
    _exigir_em_andamento(sessao)
    sessao.tabuleiro_final = _validar_grade(tabuleiro_final)
    return _encerrar(db, sessao, "vencida")


def abandonar_sessao(db: Session, sessao_id: str) -> Sessao:
    sessao = buscar_sessao(db, sessao_id)
    _exigir_em_andamento(sessao)
    return _encerrar(db, sessao, "abandonada")


def _validar_grade(grade: Any) -> list[list[str | None]]:
    if not isinstance(grade, (list, tuple)) or len(grade) != LINHAS:
        raise DadosInvalidos(f"tabuleiro_final deve ter {LINHAS} linhas.")
    limpa: list[list[str | None]] = []
    for r, linha in enumerate(grade):
        if not isinstance(linha, (list, tuple)) or len(linha) != COLUNAS:
            raise DadosInvalidos(f"A linha {r} do tabuleiro_final deve ter {COLUNAS} colunas.")
        for c, celula in enumerate(linha):
            if celula is not None and celula != VAZIO and celula not in LETRAS:
                raise DadosInvalidos(
                    f"Valor inválido {celula!r} em tabuleiro_final[{r}][{c}]: "
                    f"use uma letra de {''.join(LETRAS)}, '.' ou null."
                )
        limpa.append(list(linha))
    return limpa


# --------------------------------------------------------------------------
# Jogadas
# --------------------------------------------------------------------------

def registrar_evento(db: Session, mensagem: Mapping[str, Any]) -> Jogada:
    """Registra um evento no formato gerado por visao/pipeline.py:

    {"type": "piece_placed" | "piece_removed", "session": id, "ts": int,
     "piece": "F", "cells": [[linha, coluna], ...], "valid": true}

    A sequência é a próxima da sessão; numero_jogadas sobe só em piece_placed.
    """
    if not isinstance(mensagem, Mapping):
        raise DadosInvalidos("O evento deve ser um objeto JSON.")

    tipo = mensagem.get("type")
    if tipo not in TIPOS_JOGADA:
        raise DadosInvalidos(
            f"Tipo de evento inválido {tipo!r}; esperado um de {', '.join(TIPOS_JOGADA)}."
        )

    sessao_id = mensagem.get("session")
    if not isinstance(sessao_id, str) or not sessao_id:
        raise DadosInvalidos("O evento precisa do campo 'session' (id da sessão).")

    peca = mensagem.get("piece")
    if peca not in LETRAS:
        raise DadosInvalidos(f"Peça inválida {peca!r}; use uma de {''.join(LETRAS)}.")

    casas = _validar_casas(mensagem.get("cells"))

    valida = mensagem.get("valid")
    if not isinstance(valida, bool):
        raise DadosInvalidos("O campo 'valid' deve ser true ou false.")

    ts = _converter_ts(mensagem.get("ts"))

    sessao = buscar_sessao(db, sessao_id)
    _exigir_em_andamento(sessao)

    ultima = db.scalar(
        select(func.max(Jogada.sequencia)).where(Jogada.sessao_id == sessao.id)
    )
    jogada = Jogada(
        sessao_id=sessao.id,
        sequencia=(ultima or 0) + 1,
        tipo=tipo,
        peca=peca,
        casas=casas,
        valida=valida,
        ts=ts,
    )
    db.add(jogada)
    if tipo == "piece_placed":
        # Incremento no banco, sem ler e reescrever o valor.
        db.execute(
            update(Sessao)
            .where(Sessao.id == sessao.id)
            .values(numero_jogadas=Sessao.numero_jogadas + 1)
        )
    db.commit()
    db.refresh(sessao)
    return jogada


def _validar_casas(cells: Any) -> list[list[int]]:
    if not isinstance(cells, (list, tuple)) or not cells:
        raise DadosInvalidos("O campo 'cells' deve ser uma lista não vazia de [linha, coluna].")
    if len(cells) > LINHAS * COLUNAS:
        raise DadosInvalidos(f"'cells' tem mais casas ({len(cells)}) do que o tabuleiro.")
    casas: list[list[int]] = []
    for item in cells:
        ok = (
            isinstance(item, (list, tuple))
            and len(item) == 2
            and all(isinstance(x, int) and not isinstance(x, bool) for x in item)
        )
        if not ok:
            raise DadosInvalidos(f"Casa inválida {item!r}; esperado [linha, coluna] inteiros.")
        linha, coluna = item
        if not (0 <= linha < LINHAS and 0 <= coluna < COLUNAS):
            raise DadosInvalidos(
                f"Casa [{linha}, {coluna}] fora do tabuleiro {LINHAS}x{COLUNAS}."
            )
        casas.append([linha, coluna])
    return casas


def _converter_ts(ts: Any) -> datetime:
    if ts is None:
        return agora()
    if isinstance(ts, bool) or not isinstance(ts, (int, float)):
        raise DadosInvalidos("O campo 'ts' deve ser um número (segundos desde 1970).")
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        raise DadosInvalidos(f"Valor de 'ts' fora do intervalo: {ts!r}.") from None


# --------------------------------------------------------------------------
# Calibração
# --------------------------------------------------------------------------

def salvar_calibracao(
    db: Session, paleta: dict[str, list[float]], homografia: list[list[float]] | None
) -> Calibracao:
    calibracao = Calibracao(paleta=paleta, homografia=homografia)
    db.add(calibracao)
    db.commit()
    return calibracao


def ultima_calibracao(db: Session) -> Calibracao:
    calibracao = db.scalar(
        select(Calibracao).order_by(Calibracao.criada_em.desc(), Calibracao.id.desc()).limit(1)
    )
    if calibracao is None:
        raise NaoEncontrado("Nenhuma calibração salva.")
    return calibracao
