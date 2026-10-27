import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, criar_engine, get_db
from app.main import app

FIXTURE_DEMO = Path(__file__).parent / "fixtures" / "demo_sintetico.jsonl"


@pytest.fixture()
def db():
    """Banco SQLite em memória, novo a cada teste."""
    engine = criar_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessao = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    yield sessao
    sessao.close()
    engine.dispose()


@pytest.fixture()
def client(db):
    def _get_db():
        yield db

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def mensagens_demo() -> list[dict]:
    """Saída real de `python demo_sintetico.py` (visao/), uma mensagem por linha.

    Os `board_state` do demo imprimem a grade como lista de strings; aqui ela
    volta ao formato do pipeline (lista de listas de caracteres).
    """
    texto = FIXTURE_DEMO.read_text(encoding="utf-8-sig")
    mensagens = [json.loads(linha) for linha in texto.splitlines() if linha.strip()]
    for m in mensagens:
        if m["type"] == "board_state":
            m["grid"] = [list(linha) for linha in m["grid"]]
    return mensagens


@pytest.fixture()
def corpo_sessao() -> dict:
    return {"jogador": "Ana", "modo": "fisico", "pecas": 12}


@pytest.fixture()
def grade_vencedora(mensagens_demo) -> list[list[str]]:
    """Último estado do tabuleiro do demo, com as 12 peças encaixadas."""
    return [m for m in mensagens_demo if m["type"] == "board_state"][-1]["grid"]
