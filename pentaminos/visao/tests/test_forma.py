import unittest

import numpy as np

from config import Config
from forma import classificar_forma, divisoes
from gerar_solucoes import solucoes
from localizacao import calcular_homografia
from pentaminos import LETRAS, orientacoes
from pipeline import Pipeline
from sintetico import (CANTOS_PADRAO, CORES_APP, FUNDO_MDF, colocar_peca, com_ruido,
                       grade_vazia, projetar, renderizar)
from validador import validar_estado
from visao import Paleta, classificar, cores_das_celulas

CFG = Config(identificacao="forma")
PALETA = Paleta.de_hex(CORES_APP, FUNDO_MDF)


def cores_de(grade, cores=None, seed=0):
    img = com_ruido(renderizar(grade, cores=cores), sigma=3, rng=np.random.default_rng(seed))
    return cores_das_celulas(img, CFG.linhas, CFG.colunas, CFG.fracao_central)


def por_forma(grade, cores=None, cfg=CFG, paleta=PALETA):
    return classificar_forma(cores_de(grade, cores), paleta, cfg)


def casas_de(grade, letra):
    return sorted((r, c) for r, l in enumerate(grade) for c, x in enumerate(l) if x == letra)


class TestPecaSozinha(unittest.TestCase):
    def test_cada_letra_em_todas_as_orientacoes_com_espelho(self):
        for letra in LETRAS:
            for forma in orientacoes(letra, True):
                g = colocar_peca(grade_vazia(), letra, forma, 1, 3)
                with self.subTest(letra=letra, forma=forma):
                    self.assertEqual(por_forma(g), g)

    def test_espelho_proibido_vira_peca_invalida(self):
        cfg = Config(identificacao="forma", espelhar=False)
        for letra in ("F", "L", "N", "P", "Y", "Z"):
            so_espelho = set(orientacoes(letra, True)) - set(orientacoes(letra, False))
            forma = sorted(so_espelho)[0]
            g = colocar_peca(grade_vazia(), letra, forma, 1, 3)
            with self.subTest(letra=letra):
                estado = validar_estado(por_forma(g, cfg=cfg), espelhar=False)
                self.assertFalse(estado.pecas[letra].valida)
                self.assertEqual(estado.pecas[letra].motivo, "forma não corresponde à peça")

    def test_rotacoes_sem_espelho(self):
        cfg = Config(identificacao="forma", espelhar=False)
        for letra in LETRAS:
            for forma in orientacoes(letra, False):
                g = colocar_peca(grade_vazia(), letra, forma, 1, 3)
                with self.subTest(letra=letra, forma=forma):
                    self.assertEqual(por_forma(g, cfg=cfg), g)


class TestPecasEncostadas(unittest.TestCase):
    def test_v_e_z_com_a_mesma_cor_sao_separados_pela_forma(self):
        v = ((0, 0), (1, 0), (2, 0), (2, 1), (2, 2))
        z = ((0, 0), (0, 1), (1, 1), (2, 1), (2, 2))
        g = colocar_peca(colocar_peca(grade_vazia(), "V", v, 1, 1), "Z", z, 2, 3)
        self.assertEqual(len(divisoes(casas_de(g, "V") + casas_de(g, "Z"), True, 50)), 1)
        mesma_cor = dict(CORES_APP, Z=CORES_APP["V"])
        self.assertEqual(por_forma(g, cores=mesma_cor), g)
        cor, _ = classificar(cores_de(g, mesma_cor), PALETA, CFG.limiar_incerto, CFG.peso_l)
        self.assertNotEqual(cor, g)

    def test_i_e_t_com_cores_trocadas_na_paleta(self):
        g = colocar_peca(grade_vazia(), "I", orientacoes("I")[0], 0, 0)
        g = colocar_peca(g, "T", ((0, 0), (0, 1), (0, 2), (1, 1), (2, 1)), 1, 1)
        trocada = Paleta(dict(PALETA.cores, I=PALETA.cores["T"], T=PALETA.cores["I"]))
        self.assertEqual(por_forma(g, paleta=trocada), g)
        cor, _ = classificar(cores_de(g), trocada, CFG.limiar_incerto, CFG.peso_l)
        self.assertEqual(cor[0][0], "T")

    def test_tabuleiro_completo_com_cores_parecidas_tem_vitoria(self):
        sol = next(solucoes())
        parecidas = dict(CORES_APP, Z=CORES_APP["V"], T=CORES_APP["I"],
                         Y=CORES_APP["U"], N=CORES_APP["L"])
        g = por_forma(sol, cores=parecidas)
        self.assertEqual(g, sol)
        self.assertTrue(validar_estado(g).vitoria)
        cor, _ = classificar(cores_de(sol, parecidas), PALETA, CFG.limiar_incerto, CFG.peso_l)
        self.assertFalse(validar_estado(cor).vitoria)


class TestPecasInvalidas(unittest.TestCase):
    def test_grupo_de_4_e_grupo_de_7_continuam_invalidos(self):
        g = grade_vazia()
        for r, c in ((0, 0), (0, 1), (1, 0), (1, 1)):
            g[r][c] = "L"
        for r, c in ((3, 4), (3, 5), (3, 6), (3, 7), (4, 4), (4, 5), (4, 6)):
            g[r][c] = "P"
        estado = validar_estado(por_forma(g))
        self.assertEqual(estado.pecas["L"].motivo, "4 casas (esperado 5)")
        self.assertEqual(estado.pecas["P"].motivo, "7 casas (esperado 5)")
        self.assertFalse(estado.vitoria)

    def test_duas_pecas_com_a_mesma_forma_ficam_invalidas(self):
        f = orientacoes("F")[0]
        g = colocar_peca(colocar_peca(grade_vazia(), "F", f, 0, 0), "F", f, 2, 6)
        cores = cores_de(g, cores=dict(CORES_APP))
        cores[2:, 6:] = cores_de(colocar_peca(grade_vazia(), "X", f, 2, 6))[2:, 6:]
        estado = validar_estado(classificar_forma(cores, PALETA, CFG))
        self.assertEqual(list(estado.pecas), ["F"])
        self.assertEqual(estado.pecas["F"].motivo, "10 casas (esperado 5)")

    def test_cor_intermediaria_vira_incerta(self):
        vazio = PALETA.cores["."]
        cores = np.broadcast_to(vazio, (6, 10, 3)).copy()
        direcao = (PALETA.cores["X"] - vazio) / np.linalg.norm((PALETA.cores["X"] - vazio) * [CFG.peso_l, 1, 1])
        cores[0, 0] = vazio + direcao * CFG.limiar_ocupada
        self.assertEqual(classificar_forma(cores, PALETA, CFG)[0][0], "?")


class TestPipelineEModoCor(unittest.TestCase):
    H = calcular_homografia(CANTOS_PADRAO, CFG.largura_px, CFG.altura_px)

    def test_modo_cor_e_o_padrao_e_nao_mudou(self):
        self.assertEqual(Config().identificacao, "cor")
        sol = next(solucoes())
        quadro = com_ruido(projetar(renderizar(sol)), sigma=4, rng=np.random.default_rng(5))
        pipe = Pipeline(Config(quadros_estaveis=1), self.H, PALETA)
        msg = pipe.processar(quadro, ts=1).mensagens[0]
        from localizacao import retificar
        topo = retificar(quadro, self.H, CFG.largura_px, CFG.altura_px)
        esperado, _ = classificar(cores_das_celulas(topo, 6, 10, CFG.fracao_central),
                                  PALETA, CFG.limiar_incerto, CFG.peso_l)
        self.assertEqual(msg["grid"], esperado)

    def test_identificacao_invalida(self):
        with self.assertRaises(ValueError):
            Config(identificacao="aruco")

    def test_partida_pelo_pipeline_no_modo_forma(self):
        sol = next(solucoes())
        parecidas = dict(CORES_APP, Z=CORES_APP["V"], T=CORES_APP["I"])
        pipe = Pipeline(Config(identificacao="forma"), self.H, PALETA)
        rng = np.random.default_rng(7)
        msgs = []
        for _ in range(4):
            quadro = com_ruido(projetar(renderizar(sol, cores=parecidas)), sigma=4, rng=rng)
            msgs += pipe.processar(quadro).mensagens
        self.assertTrue(pipe.estado_atual.vitoria)
        colocadas = sorted(m["piece"] for m in msgs if m["type"] == "piece_placed")
        self.assertEqual(colocadas, sorted(LETRAS))


if __name__ == "__main__":
    unittest.main()
