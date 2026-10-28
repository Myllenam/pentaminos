import itertools
import unittest

import numpy as np

from config import Config
from gerar_solucoes import solucoes
from localizacao import (calcular_homografia, carregar_homografia, retificar,
                         salvar_homografia, validar_cantos)
from pentaminos import orientacoes
from sintetico import (CANTOS_PADRAO, CORES_APP, FUNDO_MDF, colocar_peca, com_mao,
                       com_ruido, grade_vazia, projetar, renderizar)
from visao import Paleta, classificar, construir_paleta, cores_das_celulas

CFG = Config()
PALETA = Paleta.de_hex(CORES_APP, FUNDO_MDF)


def foto(grade, **kw):
    return com_ruido(projetar(renderizar(grade)), **kw)


def retificada(grade, **kw):
    H = calcular_homografia(CANTOS_PADRAO, CFG.largura_px, CFG.altura_px)
    return retificar(foto(grade, **kw), H, CFG.largura_px, CFG.altura_px)


class TestGeometria(unittest.TestCase):
    def test_retificacao_recupera_a_vista_de_topo(self):
        g = next(solucoes(espelhar=False))
        diff = np.abs(retificada(g, sigma=0).astype(int) - renderizar(g).astype(int)).mean()
        self.assertLess(diff, 6)               

    def test_tamanho_da_imagem_retificada(self):
        self.assertEqual(retificada(grade_vazia(), sigma=0).shape, (600, 1000, 3))

    def test_cantos_invalidos(self):
        with self.assertRaises(ValueError):
            validar_cantos([(0, 0), (1, 1)])
        with self.assertRaises(ValueError):    
            validar_cantos([(0, 0), (100, 100), (100, 0), (0, 100)])

    def test_salvar_e_carregar_homografia(self):
        import tempfile, os
        H = calcular_homografia(CANTOS_PADRAO, 1000, 600)
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "sub", "h.json")
            salvar_homografia(p, CANTOS_PADRAO, H, 1000, 600)
            H2, cantos = carregar_homografia(p)
        np.testing.assert_allclose(H, H2)
        self.assertEqual(len(cantos), 4)


class TestClassificacao(unittest.TestCase):
    def test_solucoes_completas_100_por_cento(self):
        for g in itertools.islice(solucoes(espelhar=False), 3):
            cores = cores_das_celulas(retificada(g, sigma=4), 6, 10)
            grade, _ = classificar(cores, PALETA, CFG.limiar_incerto)
            self.assertEqual(grade, g)

    def test_tabuleiro_vazio(self):
        cores = cores_das_celulas(retificada(grade_vazia(), sigma=4), 6, 10)
        grade, _ = classificar(cores, PALETA, CFG.limiar_incerto)
        self.assertEqual(grade, grade_vazia())

    def test_cor_desconhecida_vira_incerta(self):
        g = grade_vazia()
        frame = com_mao(foto(g, sigma=2), 500, 250)
        H = calcular_homografia(CANTOS_PADRAO, 1000, 600)
        topo = retificar(frame, H, 1000, 600)
        grade, _ = classificar(cores_das_celulas(topo, 6, 10), PALETA, CFG.limiar_incerto)
        self.assertGreater(sum(l.count("?") for l in grade), 0)

    def test_distancias_da_paleta_do_app(self):
        pares = PALETA.distancias_entre_cores()
        self.assertEqual({pares[0][1], pares[0][2]}, {"U", "T"})
        self.assertLess(pares[0][0], 12)


class TestCalibracaoDaPaleta(unittest.TestCase):
    def _fotos_calibracao(self):
        vazio = retificada(grade_vazia(), sigma=3)
        pecas = {}
        for letra in CORES_APP:
            forma = orientacoes(letra, False)[0]
            pecas[letra] = retificada(colocar_peca(grade_vazia(), letra, forma, 0, 0), sigma=3)
        return vazio, pecas

    def test_paleta_construida_se_aproxima_da_real(self):
        vazio, pecas = self._fotos_calibracao()
        p = construir_paleta(vazio, pecas, 6, 10)
        for rotulo, ref in PALETA.cores.items():
            self.assertLess(np.linalg.norm(p.cores[rotulo] - ref), 3.0, rotulo)

    def test_paleta_construida_classifica_100_por_cento(self):
        vazio, pecas = self._fotos_calibracao()
        p = construir_paleta(vazio, pecas, 6, 10)
        g = next(solucoes(espelhar=False))
        grade, _ = classificar(cores_das_celulas(retificada(g, sigma=4), 6, 10), p, 20.0)
        self.assertEqual(grade, g)

    def test_erro_se_peca_nao_aparece(self):
        vazio, pecas = self._fotos_calibracao()
        pecas["F"] = vazio                     
        with self.assertRaisesRegex(ValueError, "Peça F"):
            construir_paleta(vazio, pecas, 6, 10)

    def test_salvar_e_carregar_paleta(self):
        import tempfile, os
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "x", "paleta.json")
            PALETA.salvar(p)
            outra = Paleta.carregar(p)
        for k in PALETA.cores:
            np.testing.assert_allclose(PALETA.cores[k], outra.cores[k], atol=1e-4)


if __name__ == "__main__":
    unittest.main()
