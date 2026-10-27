from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.constantes import MAX_PECAS
from app.db import Base, UtcDateTime


def novo_id() -> str:
    return uuid.uuid4().hex[:12]


def agora() -> datetime:
    return datetime.now(timezone.utc)


class Sessao(Base):
    __tablename__ = "sessoes"
    __table_args__ = (
        CheckConstraint("modo IN ('digital', 'fisico')", name="modo"),
        CheckConstraint(
            "status IN ('em_andamento', 'vencida', 'abandonada')", name="status"
        ),
        CheckConstraint(f"pecas BETWEEN 1 AND {MAX_PECAS}", name="pecas"),
    )

    id: Mapped[str] = mapped_column(String(12), primary_key=True, default=novo_id)
    jogador: Mapped[str] = mapped_column(String(40))
    modo: Mapped[str] = mapped_column(String(10), index=True)
    pecas: Mapped[int] = mapped_column(Integer, index=True)
    status: Mapped[str] = mapped_column(String(20), default="em_andamento", index=True)
    iniciada_em: Mapped[datetime] = mapped_column(UtcDateTime, default=agora)
    finalizada_em: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    tempo_total_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    numero_jogadas: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    dicas_usadas: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Grade 6x10 (lista de listas); NULL enquanto a sessão não termina.
    tabuleiro_final: Mapped[list | None] = mapped_column(
        JSON(none_as_null=True), nullable=True
    )

    jogadas: Mapped[list[Jogada]] = relationship(
        back_populates="sessao",
        order_by="Jogada.sequencia",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Jogada(Base):
    __tablename__ = "jogadas"
    __table_args__ = (
        UniqueConstraint("sessao_id", "sequencia"),
        CheckConstraint("tipo IN ('piece_placed', 'piece_removed')", name="tipo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sessao_id: Mapped[str] = mapped_column(
        ForeignKey("sessoes.id", ondelete="CASCADE"), index=True
    )
    sequencia: Mapped[int] = mapped_column(Integer)
    tipo: Mapped[str] = mapped_column(String(20))
    peca: Mapped[str] = mapped_column(String(1))
    # Lista de [linha, coluna].
    casas: Mapped[list] = mapped_column(JSON)
    valida: Mapped[bool] = mapped_column(Boolean)
    ts: Mapped[datetime] = mapped_column(UtcDateTime, default=agora)

    sessao: Mapped[Sessao] = relationship(back_populates="jogadas")


class Calibracao(Base):
    __tablename__ = "calibracoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # {letra ou ".": [L, a, b]}, o mesmo formato de visao/calibracao/paleta.json.
    paleta: Mapped[dict] = mapped_column(JSON)
    # Matriz 3x3; opcional.
    homografia: Mapped[list | None] = mapped_column(
        JSON(none_as_null=True), nullable=True
    )
    criada_em: Mapped[datetime] = mapped_column(UtcDateTime, default=agora)
