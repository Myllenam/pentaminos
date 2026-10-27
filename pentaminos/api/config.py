"""Configuração da API lida das variáveis de ambiente."""

import os

# SQLite por padrão. Para Postgres:
# DATABASE_URL=postgresql+psycopg://usuario:senha@host:5432/pentaminos
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pentaminos.db")

# Origens do frontend autorizadas (separadas por vírgula).
CORS_ORIGINS = [
    origem.strip()
    for origem in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origem.strip()
]
