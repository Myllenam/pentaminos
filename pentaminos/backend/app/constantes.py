"""Regras do jogo compartilhadas pelo backend.

Espelham visao/config.py (6x10) e visao/pentaminos.py (LETRAS); o backend não
importa de visao/ porque aquele serviço depende de OpenCV.
"""

LINHAS = 6
COLUNAS = 10
LETRAS = tuple("FILNPTUVWXYZ")

VAZIO = "."

MODOS = ("digital", "fisico")
STATUS = ("em_andamento", "vencida", "abandonada")
TIPOS_JOGADA = ("piece_placed", "piece_removed")

MAX_PECAS = len(LETRAS)
