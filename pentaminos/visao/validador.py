"""Validação do estado do tabuleiro (RF03) e eventos de peça colocada/removida.

O estado é uma grade de rótulos: uma letra de peça, "." (vazio) ou "?" (incerto).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from pentaminos import LETRAS, Celula, conexa, forma_corresponde

VAZIO = "."
INCERTO = "?"


@dataclass(frozen=True)
class ResultadoPeca:
    letra: str
    casas: tuple[Celula, ...]
    valida: bool
    motivo: str = ""          # vazio quando válida


@dataclass(frozen=True)
class ResultadoEstado:
    pecas: dict[str, ResultadoPeca]
    vazias: int
    incertas: int
    vitoria: bool

    @property
    def invalidas(self) -> list[str]:
        return sorted(l for l, p in self.pecas.items() if not p.valida)


@dataclass(frozen=True)
class Evento:
    tipo: str                 # "piece_placed" | "piece_removed"
    peca: str
    casas: tuple[Celula, ...]
    valida: bool


def validar_estado(grade, pecas_esperadas=LETRAS, espelhar: bool = True) -> ResultadoEstado:
    """Valida cada peça presente e detecta vitória.

    Uma peça é válida se ocupa exatamente 5 casas conectadas com a forma de uma
    das suas orientações permitidas (8 se `espelhar`, 4 se não).
    Vitória: nenhuma casa vazia/incerta, todas as peças válidas e todas as
    `pecas_esperadas` presentes.
    """
    por_letra: dict[str, list[Celula]] = {}
    vazias = incertas = 0
    for r, linha in enumerate(grade):
        for c, rotulo in enumerate(linha):
            if rotulo == VAZIO:
                vazias += 1
            elif rotulo == INCERTO:
                incertas += 1
            else:
                por_letra.setdefault(rotulo, []).append((r, c))

    pecas: dict[str, ResultadoPeca] = {}
    for letra, casas in sorted(por_letra.items()):
        casas_t = tuple(casas)
        if letra not in pecas_esperadas:
            motivo = "peça desconhecida"
        elif len(casas) != 5:
            motivo = f"{len(casas)} casas (esperado 5)"
        elif not conexa(casas):
            motivo = "casas não conectadas"
        elif not forma_corresponde(letra, casas, espelhar):
            motivo = "forma não corresponde à peça"
        else:
            motivo = ""
        pecas[letra] = ResultadoPeca(letra, casas_t, motivo == "", motivo)

    vitoria = (
        vazias == 0
        and incertas == 0
        and all(p.valida for p in pecas.values())
        and set(pecas) == set(pecas_esperadas)
    )
    return ResultadoEstado(pecas, vazias, incertas, vitoria)


def diferencas(anterior: ResultadoEstado | None, novo: ResultadoEstado) -> list[Evento]:
    """Eventos entre dois estados estáveis. Peça que mudou de lugar gera
    uma remoção (posição antiga) seguida de uma colocação (posição nova)."""
    antigas = anterior.pecas if anterior else {}
    removidas, colocadas = [], []
    for letra in sorted(set(antigas) | set(novo.pecas)):
        a, n = antigas.get(letra), novo.pecas.get(letra)
        if a and n and a.casas == n.casas and a.valida == n.valida:
            continue
        if a:
            removidas.append(Evento("piece_removed", letra, a.casas, a.valida))
        if n:
            colocadas.append(Evento("piece_placed", letra, n.casas, n.valida))
    return removidas + colocadas
