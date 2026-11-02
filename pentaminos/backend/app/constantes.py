"""Regras do jogo (iguais às de visao/)."""

LINHAS = 6
COLUNAS = 10
LETRAS = tuple("FILNPTUVWXYZ")

VAZIO = "."

MODOS = ("digital", "fisico")
STATUS = ("em_andamento", "vencida", "abandonada")
TIPOS_JOGADA = ("piece_placed", "piece_removed")

MAX_PECAS = len(LETRAS)
