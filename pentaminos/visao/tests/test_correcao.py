import unittest

import numpy as np

from config import Config
from localizacao import calcular_homografia
from pipeline import Pipeline
from gerar_solucoes import solucoes
from sintetico import (CANTOS_PADRAO, CORES_APP, FUNDO_MDF, colocar_peca, com_ruido, grade_vazia,
                       projetar, renderizar)
from visao import Paleta

CFG = Config(identificacao="cor")
H = calcular_homografia(CANTOS_PADRAO, CFG.largura_px, CFG.altura_px)
PALETA = Paleta.de_hex(CORES_APP, FUNDO_MDF)
V = ((0, 0), (1, 0), (2, 0), (2, 1), (2, 2))
Z = ((0, 0), (0, 1), (1, 1), (2, 1), (2, 2))
GRADE = colocar_peca(colocar_peca(grade_vazia(), "V", V, 1, 1), "Z", Z, 2, 3)
CASAS_Z = [[r, c] for r, l in enumerate(GRADE) for c, x in enumerate(l) if x == "Z"]
MESMA_COR = dict(CORES_APP, Z=CORES_APP["V"])


def rodar(pipe, grade, rng, inicio, n=4, passo=0.5):
    msgs = []
    for i in range(n):
        q = com_ruido(projetar(renderizar(grade, cores=MESMA_COR)), sigma=3, rng=rng)
        msgs += pipe.processar(q, ts=1, agora=inicio + i * passo).mensagens
    return msgs


class TestDuvidaECorrecao(unittest.TestCase):
    def test_peca_invalida_vira_duvida_depois_do_tempo(self):
        pipe = Pipeline(CFG, H, PALETA)
        rng = np.random.default_rng(1)
        antes = rodar(pipe, GRADE, rng, 0.0, n=4)
        self.assertFalse(any("duvidas" in m for m in antes))
        depois = [m for m in rodar(pipe, GRADE, rng, 4.0, n=2) if m["type"] == "board_state"]
        self.assertEqual(len(depois), 1)
        duvida = depois[0]["duvidas"][0]
        self.assertEqual(set(duvida["candidatas"]), {"V", "Z"})
        self.assertEqual(len(duvida["cells"]), 10)

    def test_jogador_nomeia_a_peca_e_as_duas_ficam_validas(self):
        pipe = Pipeline(CFG, H, PALETA)
        rng = np.random.default_rng(2)
        rodar(pipe, GRADE, rng, 0.0, n=8)
        self.assertFalse(pipe.estado_atual.pecas["V"].valida)
        self.assertIsNone(pipe.atribuir(CASAS_Z, "Z"))
        msgs = rodar(pipe, GRADE, rng, 5.0, n=7)
        self.assertTrue(pipe.estado_atual.pecas["Z"].valida)
        self.assertTrue(pipe.estado_atual.pecas["V"].valida)
        ultimo = [m for m in msgs if m["type"] == "board_state"][-1]
        self.assertNotIn("duvidas", ultimo)

    def test_correcao_com_forma_errada_e_recusada(self):
        pipe = Pipeline(CFG, H, PALETA)
        self.assertEqual(pipe.atribuir(CASAS_Z, "V"), "as casas não formam a peça V")
        self.assertEqual(pipe.atribuir(CASAS_Z[:4], "Z"), "as casas não formam a peça Z")
        self.assertEqual(pipe.correcoes.pecas, {})

    def test_correcao_e_descartada_quando_a_peca_sai(self):
        pipe = Pipeline(CFG, H, PALETA)
        rng = np.random.default_rng(3)
        pipe.atribuir(CASAS_Z, "Z")
        rodar(pipe, GRADE, rng, 0.0)
        avisos = []
        for i in range(CFG.quadros_estaveis):
            q = com_ruido(projetar(renderizar(grade_vazia())), sigma=3, rng=rng)
            avisos += pipe.processar(q, ts=1, agora=10 + i).avisos
        self.assertEqual(avisos, ["correção de Z descartada: casas vazias"])
        self.assertEqual(pipe.correcoes.pecas, {})


def com_estranhas(grade, estranhas, rng, cores=None):
    img = renderizar(grade, cores=cores)
    for r, c in estranhas:   # cor longe da paleta: casa "?"
        img[r * 100:(r + 1) * 100, c * 100:(c + 1) * 100] = (32, 255, 32)
    return com_ruido(projetar(img), sigma=3, rng=rng)


def duvidas_publicadas(grade, estranhas, seed, n=10):
    pipe = Pipeline(CFG, H, PALETA)
    rng = np.random.default_rng(seed)
    saida = []
    for i in range(n):
        for m in pipe.processar(com_estranhas(grade, estranhas, rng), ts=1, agora=i * 0.5).mensagens:
            if m["type"] == "board_state":
                saida.append((i * 0.5, m.get("duvidas")))
    return saida


class TestRegiaoDaDuvida(unittest.TestCase):
    def test_v_com_4_casas_e_uma_incerta(self):
        g = colocar_peca(grade_vazia(), "V", V, 1, 1)
        estados = duvidas_publicadas(g, [(3, 3)], seed=4)
        self.assertIsNone(estados[0][1])
        quando, duvidas = estados[-1]
        self.assertGreaterEqual(quando, CFG.segundos_duvida)
        self.assertEqual(duvidas, [{"id": "d1", "cells": [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3]],
                                    "candidatas": ["V"]}])

    def test_p_com_3_casas_e_duas_incertas(self):
        p = ((0, 0), (0, 1), (1, 0), (1, 1), (2, 0))
        g = colocar_peca(grade_vazia(), "P", p, 1, 5)
        quando, duvidas = duvidas_publicadas(g, [(2, 6), (3, 5)], seed=5)[-1]
        self.assertGreaterEqual(quando, CFG.segundos_duvida)
        self.assertEqual(duvidas, [{"id": "d1", "cells": [[1, 5], [1, 6], [2, 5], [2, 6], [3, 5]],
                                    "candidatas": ["P"]}])


class TestCorrecaoNaPartida(unittest.TestCase):
    def test_peca_corrigida_vai_como_manual_e_conta_na_vitoria(self):
        sol = next(solucoes())
        casas_z = [[r, c] for r, l in enumerate(sol) for c, x in enumerate(l) if x == "Z"]
        pipe = Pipeline(CFG, H, PALETA)
        rng = np.random.default_rng(8)
        quadro = lambda: com_ruido(projetar(renderizar(sol, cores=MESMA_COR)), sigma=3, rng=rng)
        for i in range(8):
            pipe.processar(quadro(), ts=1, agora=i * 0.5)
        self.assertFalse(pipe.estado_atual.vitoria)
        self.assertIsNone(pipe.atribuir(casas_z, "Z"))
        msgs = []
        for i in range(8):
            msgs += pipe.processar(quadro(), ts=1, agora=5 + i * 0.5).mensagens
        colocadas = {m["piece"]: m for m in msgs if m["type"] == "piece_placed"}
        self.assertTrue(colocadas["Z"]["manual"])
        self.assertNotIn("manual", colocadas["V"])
        self.assertTrue(pipe.estado_atual.vitoria)


if __name__ == "__main__":
    unittest.main()
