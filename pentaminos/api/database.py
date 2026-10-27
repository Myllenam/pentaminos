"""Conexão com o banco (SQLite ou Postgres) via SQLAlchemy."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import DATABASE_URL


class Base(DeclarativeBase):
    pass


def criar_engine(url: str, **kwargs):
    # O SQLite precisa liberar o uso da conexão
    # em threads diferentes (o FastAPI usa várias).
    if url.startswith("sqlite"):
        kwargs.setdefault("connect_args", {"check_same_thread": False})
    return create_engine(url, **kwargs)


engine = criar_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


def get_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
