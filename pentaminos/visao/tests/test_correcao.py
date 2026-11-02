import unittest

import numpy as np

from config import Config
from localizacao import calcular_homografia
from pipeline import Pipeline
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
    def test_peca_invalida_vira_duvida_depois_de_3_s(self):
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
        msgs = rodar(pipe, GRADE, rng, 5.0)
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


if __name__ == "__main__":
    unittest.main()
