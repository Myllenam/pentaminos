import unittest

import numpy as np

from config import Config
from gerar_solucoes import solucoes
from localizacao import calcular_homografia
from monitor import Instabilidade, Resumo
from pipeline import Pipeline
from sintetico import CANTOS_PADRAO, CORES_APP, FUNDO_MDF, com_mao, com_ruido, projetar, renderizar
from visao import Paleta

CFG = Config(identificacao="cor")
H = calcular_homografia(CANTOS_PADRAO, CFG.largura_px, CFG.altura_px)
PALETA = Paleta.de_hex(CORES_APP, FUNDO_MDF)
SOL = next(solucoes())


def quadro(grade, rng, escuras=(), mao=None):
    topo = renderizar(grade)
    for r, c in escuras:   # casa que nenhuma cor da paleta explica → "?"
        topo[r * 100:(r + 1) * 100, c * 100:(c + 1) * 100] = 0
    f = com_ruido(projetar(topo), sigma=3, rng=rng)
    return com_mao(f, *mao) if mao else f


SEIS = [(0, 0), (1, 3), (2, 5), (3, 7), (4, 9), (5, 2)]


class TestNaoCongela(unittest.TestCase):
    def test_seis_casas_incertas_nao_descartam_o_quadro(self):
        pipe = Pipeline(CFG, H, PALETA)
        rng = np.random.default_rng(1)
        resultados = [pipe.processar(quadro(SOL, rng, SEIS)) for _ in range(4)]
        self.assertFalse(any(r.descartado for r in resultados))
        grid = next(m for r in resultados for m in r.mensagens if m["type"] == "board_state")["grid"]
        self.assertEqual(sum(x == "?" for l in grid for x in l), 6)

    def test_casa_incerta_herda_a_letra_publicada(self):
        pipe = Pipeline(CFG, H, PALETA)
        rng = np.random.default_rng(2)
        for _ in range(3):
            pipe.processar(quadro(SOL, rng))
        self.assertTrue(pipe.estado_atual.vitoria)
        msgs = [m for _ in range(5) for m in pipe.processar(quadro(SOL, rng, SEIS)).mensagens]
        self.assertEqual(msgs, [])
        self.assertTrue(pipe.estado_atual.vitoria)

    def test_casa_sem_letra_anterior_continua_incerta(self):
        pipe = Pipeline(CFG, H, PALETA)
        rng = np.random.default_rng(3)
        msgs = [m for _ in range(3) for m in pipe.processar(quadro(SOL, rng, SEIS[:1])).mensagens]
        self.assertEqual(msgs[0]["grid"][0][0], "?")
        self.assertFalse(pipe.estado_atual.vitoria)

    def test_mao_do_tamanho_real_e_descartada(self):
        pipe = Pipeline(CFG, H, PALETA)
        f = com_mao(quadro(SOL, np.random.default_rng(4)), 380, 200, largura=420, altura=380)
        r = pipe.processar(f)
        self.assertTrue(r.descartado)
        self.assertIn("casas incertas", r.motivo)

    def test_tabuleiro_cheio_desde_o_primeiro_quadro(self):
        for modo in ("cor", "forma", "combinado"):
            pipe = Pipeline(Config(identificacao=modo), H, PALETA)
            rng = np.random.default_rng(5)
            msgs = [m for _ in range(Config().quadros_estaveis) for m in pipe.processar(quadro(SOL, rng)).mensagens]
            with self.subTest(modo=modo):
                self.assertEqual(msgs[0]["type"], "board_state")
                self.assertTrue(pipe.estado_atual.vitoria)


class TestMonitor(unittest.TestCase):
    def test_resumo_a_cada_dois_segundos(self):
        resumo = Resumo(2.0)
        linhas = [resumo.registrar(i % 10 != 0, "6 casas incertas", i == 5, i * 0.1) for i in range(21)]
        self.assertEqual([l for l in linhas if l], ["descartados 18/21: 6 casas incertas; publicados 1"])

    def test_leitura_instavel_depois_de_tres_segundos(self):
        inst = Instabilidade(3.0)
        mudancas = [inst.atualizar(True, "movimento", t / 10) for t in range(35)]
        self.assertEqual([m for m in mudancas if m], [{"status": "leitura_instavel", "detail": "movimento"}])
        self.assertEqual(inst.atualizar(False, "", 3.6), {"status": "tabuleiro_detectado"})
        self.assertIsNone(inst.atualizar(False, "", 3.7))


if __name__ == "__main__":
    unittest.main()
