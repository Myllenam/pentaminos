from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import services
from app.db import get_db
from app.schemas import CalibracaoCriar, CalibracaoOut

router = APIRouter(prefix="/calibration", tags=["calibração"])


@router.post("", response_model=CalibracaoOut, status_code=status.HTTP_201_CREATED)
def salvar(corpo: CalibracaoCriar, db: Session = Depends(get_db)):
    return services.salvar_calibracao(db, corpo.paleta, corpo.homografia)


@router.get("/latest", response_model=CalibracaoOut)
def ultima(db: Session = Depends(get_db)):
    return services.ultima_calibracao(db)
