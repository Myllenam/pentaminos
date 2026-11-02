import unittest

import numpy as np

from config import Config
from estabilizacao import Estabilizador, Votador
from gerar_solucoes import solucoes
from localizacao import calcular_homografia
from monitor import Instabilidade, Resumo
from pipeline import Pipeline
from validador import diferencas, validar_estado
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



def simular(grades, janela, estaveis=3):
    """Votação + estabilização + validação, sem imagem: devolve as peças colocadas."""
    votos, estab, anterior, colocadas = Votador(janela), Estabilizador(estaveis), None, []
    for g in grades:
        novo = estab.atualizar(votos.votar(g, estab.publicado))
        if novo is not None:
            estado = validar_estado(novo)
            colocadas += [e.peca for e in diferencas(anterior, estado) if e.tipo == "piece_placed"]
            anterior = estado
    return colocadas


def com_piscadas(sol, quadros=300, seed=0):
    """Tabuleiro cheio; de vez em quando uma casa vira outra letra por 1 a 3 quadros."""
    rng = np.random.default_rng(seed)
    grades, fim, casa, letra = [], -1, None, None
    for i in range(quadros):
        if i > fim and rng.random() < 0.1:
            casa = (int(rng.integers(6)), int(rng.integers(10)))
            letra = str(rng.choice([l for l in "FILNPTUVWXYZ" if l != sol[casa[0]][casa[1]]]))
            fim = i + int(rng.integers(1, 4)) - 1
        g = [l[:] for l in sol]
        if i <= fim:
            g[casa[0]][casa[1]] = letra
        grades.append(g)
    return grades


class TestContagemDeJogadas(unittest.TestCase):
    def test_votacao_ignora_piscadas_de_ate_3_quadros(self):
        grades = com_piscadas(SOL)
        antigo = simular(grades, janela=1)
        novo = simular(grades, janela=Config().janela_votos)
        self.assertGreater(len(antigo), 24)        # cada piscada vira jogada no jeito antigo
        self.assertEqual(sorted(novo), sorted("FILNPTUVWXYZ"))

    def test_ruido_de_um_quadro_nao_atrasa_a_publicacao(self):
        rng = np.random.default_rng(1)
        grades = []
        for _ in range(300):   # metade dos quadros com uma casa "?"
            g = [l[:] for l in SOL]
            if rng.random() < 0.5:
                g[int(rng.integers(6))][int(rng.integers(10))] = "?"
            grades.append(g)

        def primeiro(janela, estaveis):
            votos, estab = Votador(janela), Estabilizador(estaveis)
            return next(i for i, g in enumerate(grades) if estab.atualizar(votos.votar(g, estab.publicado)))

        self.assertLess(primeiro(Config().janela_votos, Config().quadros_estaveis), 5)
        self.assertGreater(primeiro(1, 5), 50)   # só subir quadros_estaveis travaria a tela

    def test_peca_nova_aparece_em_ate_6_quadros(self):
        sem_i = [[x if x != "I" else "." for x in l] for l in SOL]
        grades = [sem_i] * 20 + [SOL] * 10
        votos, estab = Votador(Config().janela_votos), Estabilizador(Config().quadros_estaveis)
        quando = [i for i, g in enumerate(grades) if estab.atualizar(votos.votar(g, estab.publicado))]
        self.assertEqual(quando[-1] - 20, 5)       # 6º quadro depois de pôr a peça


if __name__ == "__main__":
    unittest.main()
