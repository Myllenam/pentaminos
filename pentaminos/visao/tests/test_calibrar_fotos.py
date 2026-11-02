import itertools
import unittest

import numpy as np

from calibrar_fotos import _letra_pela_forma, gabarito_das_sequencias
from config import Config
from gerar_solucoes import solucoes
from pentaminos import FORMAS_BASE, LETRAS
from visao import INCERTO, Paleta, classificar

CFG = Config()


class TestGabarito(unittest.TestCase):
    def test_letra_pela_forma_das_12_pecas(self):
        for letra, forma in FORMAS_BASE.items():
            self.assertEqual(_letra_pela_forma(list(forma)), letra)

    def test_forma_com_4_casas_nao_tem_letra(self):
        self.assertIsNone(_letra_pela_forma([(0, 0), (0, 1), (0, 2), (0, 3)]))

    def test_sequencia_de_fotos_vira_a_solucao(self):
        solucao = next(solucoes(espelhar=False))
        cel = {}
        for k in range(1, 13):
            nome = f"tabuleiro_1_{k}_pecas" if k < 12 else "tabuleiro_1_completo"
            lab = np.zeros((6, 10, 3), np.float32)
            lab[..., 0] = 85                                   # papel: croma ~0
            for r, c in itertools.product(range(6), range(10)):
                if solucao[r][c] in LETRAS[:k]:
                    lab[r, c] = (40, 40, 20)                   # peça: croma alto
            cel[nome] = lab
        gt = gabarito_das_sequencias(cel, list(cel))
        self.assertEqual(gt["tabuleiro_1_completo"], solucao)
        self.assertEqual(sum(c != "." for linha in gt["tabuleiro_1_5_pecas"] for c in linha), 25)


class TestPesoL(unittest.TestCase):
    def setUp(self):
        self.paleta = Paleta({"V": np.array([20, 17, 12], np.float32),
                              "Z": np.array([32, 17, 12], np.float32)})
        self.casa = np.array([[[50, 17, 12]]], np.float32)     # só a luminosidade está fora

    def test_peso_1_marca_incerto(self):
        grade, _ = classificar(self.casa, self.paleta, 16.0, peso_l=1.0)
        self.assertEqual(grade, [[INCERTO]])

    def test_peso_menor_aceita_a_mesma_casa(self):
        grade, d = classificar(self.casa, self.paleta, 16.0, peso_l=0.5)
        self.assertEqual(grade, [["Z"]])
        self.assertAlmostEqual(float(d[0, 0]), 9.0, places=4)

    def test_peso_padrao_nao_muda_o_comportamento_antigo(self):
        a, _ = classificar(self.casa, self.paleta, 16.0)
        b, _ = classificar(self.casa, self.paleta, 16.0, peso_l=1.0)
        self.assertEqual(a, b)

    def test_distancias_entre_cores_usam_o_peso(self):
        d1 = self.paleta.distancias_entre_cores()[0][0]
        d2 = self.paleta.distancias_entre_cores(peso_l=0.5)[0][0]
        self.assertAlmostEqual(d1, 12.0, places=4)
        self.assertAlmostEqual(d2, 6.0, places=4)


if __name__ == "__main__":
    unittest.main()
