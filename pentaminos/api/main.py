"""API do ranking do Pentaminós.

Rodar: uvicorn main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

import models
from config import CORS_ORIGINS
from database import Base, engine, get_session
from schemas import (
    GameMode,
    RankingEntryCreate,
    RankingEntryRead,
    RankingSort,
    tempo_em_segundos,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Pentaminós — Ranking", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/ranking", response_model=list[RankingEntryRead])
def listar_ranking(
    pieces: int | None = Query(default=None, ge=3, le=12),
    mode: GameMode | None = None,
    sort_by: RankingSort = Query(default="time", alias="sortBy"),
    session: Session = Depends(get_session),
):
    consulta = select(models.RankingEntry)

    if pieces is not None:
        consulta = consulta.where(models.RankingEntry.pieces == pieces)

    if mode is not None:
        consulta = consulta.where(models.RankingEntry.mode == mode)

    # Mesmo critério do frontend: ordena pelo
    # critério escolhido e desempata pelo outro.
    tempo = models.RankingEntry.time_seconds
    movimentos = models.RankingEntry.moves
    ordem = (movimentos, tempo) if sort_by == "moves" else (tempo, movimentos)

    return session.scalars(consulta.order_by(*ordem)).all()


@app.post(
    "/ranking",
    response_model=RankingEntryRead,
    status_code=status.HTTP_201_CREATED,
)
def salvar_resultado(
    entrada: RankingEntryCreate,
    session: Session = Depends(get_session),
):
    # Soluções do algoritmo nunca entram no ranking.
    if entrada.auto_solved:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Soluções automáticas não entram no ranking.",
        )

    registro = models.RankingEntry(
        player=entrada.player,
        time=entrada.time,
        time_seconds=tempo_em_segundos(entrada.time),
        pieces=entrada.pieces,
        moves=entrada.moves,
        mode=entrada.mode,
        date=entrada.date,
        placements=[
            passo.model_dump(by_alias=True) for passo in entrada.placements
        ],
        final_board=entrada.final_board,
    )

    session.add(registro)
    session.commit()
    session.refresh(registro)

    return registro


@app.delete("/ranking", status_code=status.HTTP_204_NO_CONTENT)
def limpar_ranking(session: Session = Depends(get_session)):
    session.execute(delete(models.RankingEntry))
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
