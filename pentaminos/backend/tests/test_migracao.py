from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import inspect

from app.db import Base, criar_engine

RAIZ = Path(__file__).resolve().parent.parent


def config_alembic(url: str) -> Config:
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


def test_upgrade_cria_as_tabelas_e_bate_com_os_modelos(tmp_path):
    url = f"sqlite:///{tmp_path / 'novo.db'}"

    command.upgrade(config_alembic(url), "head")

    engine = criar_engine(url)
    assert {"sessoes", "jogadas", "calibracoes"} <= set(inspect(engine).get_table_names())
    with engine.connect() as conn:
        diferencas = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diferencas == [], f"a migração não reflete os modelos: {diferencas}"


def test_downgrade_remove_as_tabelas(tmp_path):
    url = f"sqlite:///{tmp_path / 'novo.db'}"
    cfg = config_alembic(url)

    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")

    tabelas = set(inspect(criar_engine(url)).get_table_names())
    assert tabelas <= {"alembic_version"}
