from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import services
from app.db import get_db
from app.schemas import (
    FinalizarSessao,
    Modo,
    SessaoCriar,
    SessaoDetalhe,
    SessaoOut,
    StatusSessao,
)

router = APIRouter(prefix="/sessions", tags=["sessões"])


@router.post("", response_model=SessaoOut, status_code=status.HTTP_201_CREATED)
def criar(corpo: SessaoCriar, db: Session = Depends(get_db)):
    return services.criar_sessao(db, corpo.jogador, corpo.modo, corpo.pecas)


@router.get("", response_model=list[SessaoOut])
def listar(
    jogador: str | None = None,
    modo: Modo | None = None,
    pecas: int | None = None,
    status: StatusSessao | None = None,
    db: Session = Depends(get_db),
):
    return services.listar_sessoes(db, jogador, modo, pecas, status)


@router.get("/{sessao_id}", response_model=SessaoDetalhe)
def detalhar(sessao_id: str, db: Session = Depends(get_db)):
    return services.buscar_sessao(db, sessao_id)


@router.post("/{sessao_id}/finish", response_model=SessaoOut)
def finalizar(sessao_id: str, corpo: FinalizarSessao, db: Session = Depends(get_db)):
    return services.finalizar_sessao(db, sessao_id, corpo.tabuleiro_final)


@router.post("/{sessao_id}/abandon", response_model=SessaoOut)
def abandonar(sessao_id: str, db: Session = Depends(get_db)):
    return services.abandonar_sessao(db, sessao_id)
