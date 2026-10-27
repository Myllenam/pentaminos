from __future__ import annotations

import json

import numpy as np

from config import Config
from gerar_solucoes import solucoes
from localizacao import calcular_homografia
from pipeline import Pipeline
from sintetico import (CANTOS_PADRAO, CORES_APP, FUNDO_MDF, com_mao, com_ruido,
                       grade_vazia, projetar, renderizar)
from visao import Paleta

cfg = Config()
H = calcular_homografia(CANTOS_PADRAO, cfg.largura_px, cfg.altura_px)
pipe = Pipeline(cfg, H, Paleta.de_hex(CORES_APP, FUNDO_MDF), sessao="demo")
rng = np.random.default_rng(7)

solucao = next(solucoes(espelhar=False))
letras = sorted({x for l in solucao for x in l if x != "."})


def estado(ativas):
    return [[x if x in ativas else "." for x in l] for l in solucao]


def quadro(grade, mao=None):
    f = com_ruido(projetar(renderizar(grade)), sigma=4, rng=rng)
    return com_mao(f, *mao) if mao else f


def rodar(grade, mao_frames=2, parado=4):
    for _ in range(mao_frames):
        r = pipe.processar(quadro(grade, mao=(440, 230)))
        print(f"  [quadro descartado: {r.motivo}]" if r.descartado else "", end="")
    for _ in range(parado):
        for m in pipe.processar(quadro(grade)).mensagens:
            resumo = {k: v for k, v in m.items() if k != "grid"}
            if m["type"] == "board_state":
                resumo["grid"] = ["".join(l) for l in m["grid"]]
            print("\n" + json.dumps(resumo, ensure_ascii=False), end="")
    print()


print("== tabuleiro vazio ==")
rodar(grade_vazia(), mao_frames=0)
ativas = set()
for letra in letras:
    ativas.add(letra)
    print(f"== coloca {letra} ==")
    rodar(estado(ativas))
    if letra == letras[2]:                       
        print(f"== tira {letras[1]} ==")
        rodar(estado(ativas - {letras[1]}))
        print(f"== recoloca {letras[1]} ==")
        rodar(estado(ativas))
print("\nVITÓRIA:", pipe.estado_atual.vitoria)
