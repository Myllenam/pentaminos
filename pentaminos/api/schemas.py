"""Formato do JSON trocado com o frontend (camelCase)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

PentominoId = Literal["F", "I", "L", "N", "P", "T", "U", "V", "W", "X", "Y", "Z"]
GameMode = Literal["digital", "fisico"]
RankingSort = Literal["time", "moves"]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )


class PlacementStep(CamelModel):
    order: int = Field(ge=1)
    shape_id: PentominoId
    rotation: Literal[0, 90, 180, 270]
    origin: tuple[int, int]


class RankingEntryCreate(CamelModel):
    player: str = Field(min_length=1, max_length=40)
    time: str = Field(pattern=r"^\d{2,}:[0-5]\d$")
    pieces: int = Field(ge=3, le=12)
    moves: int = Field(ge=0)
    date: str = Field(max_length=10)
    mode: GameMode = "digital"
    auto_solved: bool = False
    placements: list[PlacementStep]
    final_board: list[list[PentominoId | None]]

    @field_validator("player")
    @classmethod
    def remover_espacos(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("O nome do jogador não pode ficar vazio.")
        return valor


class RankingEntryRead(CamelModel):
    id: str
    player: str
    time: str
    pieces: int
    moves: int
    date: str
    mode: GameMode
    placements: list[PlacementStep]
    final_board: list[list[PentominoId | None]]


def tempo_em_segundos(tempo: str) -> int:
    minutos, segundos = tempo.split(":")
    return int(minutos) * 60 + int(segundos)
