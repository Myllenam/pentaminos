"""Resumo do log e detecção de leitura instável do loop ao vivo."""
from __future__ import annotations

from collections import Counter


class Resumo:
    """Devolve uma linha de log a cada `intervalo` segundos."""

    def __init__(self, intervalo: float = 2.0):
        self.intervalo = intervalo
        self._inicio: float | None = None
        self._total = self._publicados = 0
        self._motivos: Counter[str] = Counter()

    def registrar(self, descartado: bool, motivo: str, publicou: bool, agora: float) -> str | None:
        if self._inicio is None:
            self._inicio = agora
        self._total += 1
        self._publicados += publicou
        if descartado:
            self._motivos[motivo] += 1
        if agora - self._inicio < self.intervalo:
            return None
        descartados = sum(self._motivos.values())
        motivo_comum = f": {self._motivos.most_common(1)[0][0]}" if descartados else ""
        linha = f"descartados {descartados}/{self._total}{motivo_comum}; publicados {self._publicados}"
        self._inicio, self._total, self._publicados = agora, 0, 0
        self._motivos.clear()
        return linha


class Instabilidade:
    """Status da câmera conforme os descartes seguidos."""

    def __init__(self, limite_s: float = 3.0):
        self.limite_s = limite_s
        self._desde: float | None = None
        self.instavel = False

    def atualizar(self, descartado: bool, motivo: str, agora: float) -> dict | None:
        if not descartado:
            self._desde = None
            if self.instavel:
                self.instavel = False
                return {"status": "tabuleiro_detectado"}
            return None
        if self._desde is None:
            self._desde = agora
        if not self.instavel and agora - self._desde > self.limite_s:
            self.instavel = True
            return {"status": "leitura_instavel", "detail": motivo}
        return None
