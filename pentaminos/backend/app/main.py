from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import calibration, health, sessions
from app.services import ErroServico

app = FastAPI(title="Pentaminós — backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origens_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ErroServico)
def tratar_erro_servico(_: Request, erro: ErroServico):
    return JSONResponse(status_code=erro.status_code, content={"detail": erro.detail})


# Para adicionar o WebSocket: criar app/routers/ws.py com um APIRouter e
# chamar services.registrar_evento(db, mensagem) a cada mensagem recebida.
for router in (health.router, sessions.router, calibration.router):
    app.include_router(router)
