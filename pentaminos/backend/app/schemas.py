from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.constantes import LETRAS, MAX_PECAS, VAZIO

Modo = Literal["digital", "fisico"]
StatusSessao = Literal["em_andamento", "vencida", "abandonada"]
TipoJogada = Literal["piece_placed", "piece_removed"]


class SessaoCriar(BaseModel):
    jogador: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    modo: Modo
    pecas: int = Field(ge=1, le=MAX_PECAS)


class FinalizarSessao(BaseModel):
    # O formato 6x10 é conferido em services.finalizar_sessao.
    tabuleiro_final: list[list[str | None]]


class JogadaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sessao_id: str
    sequencia: int
    tipo: TipoJogada
    peca: str
    casas: list[list[int]]
    valida: bool
    ts: datetime


class SessaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    jogador: str
    modo: Modo
    pecas: int
    status: StatusSessao
    iniciada_em: datetime
    finalizada_em: datetime | None
    tempo_total_s: int | None
    numero_jogadas: int
    dicas_usadas: int
    tabuleiro_final: list[list[str | None]] | None


class SessaoDetalhe(SessaoOut):
    jogadas: list[JogadaOut]


class CalibracaoCriar(BaseModel):
    paleta: dict[str, list[float]]
    homografia: list[list[float]] | None = None

    @field_validator("paleta")
    @classmethod
    def _validar_paleta(cls, paleta: dict[str, list[float]]):
        if not paleta:
            raise ValueError("a paleta não pode ser vazia")
        validas = {*LETRAS, VAZIO}
        for chave, cor in paleta.items():
            if chave not in validas:
                raise ValueError(f"chave inválida {chave!r}: use uma letra de peça ou '.'")
            if len(cor) != 3:
                raise ValueError(f"a cor de {chave!r} deve ter 3 valores [L, a, b]")
        return paleta

    @field_validator("homografia")
    @classmethod
    def _validar_homografia(cls, h: list[list[float]] | None):
        if h is not None and (len(h) != 3 or any(len(linha) != 3 for linha in h)):
            raise ValueError("a homografia deve ser uma matriz 3x3")
        return h


class CalibracaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    paleta: dict[str, list[float]]
    homografia: list[list[float]] | None
    criada_em: datetime
