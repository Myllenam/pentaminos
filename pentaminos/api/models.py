"""Tabelas do banco."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RankingEntry(Base):
    __tablename__ = "ranking"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    player: Mapped[str] = mapped_column(String(40))
    # Tempo no formato "mm:ss", como o frontend mostra.
    time: Mapped[str] = mapped_column(String(10))
    # Mesmo tempo em segundos, usado para ordenar.
    time_seconds: Mapped[int] = mapped_column(Integer, index=True)
    pieces: Mapped[int] = mapped_column(Integer, index=True)
    moves: Mapped[int] = mapped_column(Integer)
    mode: Mapped[str] = mapped_column(String(10), index=True)
    # Data no formato "dd/mm" enviada pelo frontend.
    date: Mapped[str] = mapped_column(String(10))
    # Lista de passos: [{order, shapeId, rotation, origin}].
    placements: Mapped[list] = mapped_column(JSON)
    # Grade com a letra da peça em cada célula (ou null).
    final_board: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
