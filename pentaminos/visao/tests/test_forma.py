import time
import unittest

import cv2
import numpy as np

from config import Config
from forma import classificar_combinado, classificar_forma, distancia, divisoes
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


class TestCombinado(unittest.TestCase):
    CFG = Config()

    def test_combinado_e_o_padrao(self):
        self.assertEqual(self.CFG.identificacao, "combinado")

    def test_usa_o_modo_cor_quando_ele_funciona(self):
        sol = next(solucoes())
        cores = cores_de(sol)
        por_cor, _ = classificar(cores, PALETA, CFG.limiar_incerto, CFG.peso_l)
        self.assertTrue(validar_estado(por_cor).vitoria)
        self.assertEqual(classificar_combinado(cores, PALETA, self.CFG), por_cor)

    def test_usa_o_modo_forma_quando_o_cor_falha(self):
        sol = next(solucoes())
        cores = cores_de(sol, dict(CORES_APP, Z=CORES_APP["V"], T=CORES_APP["I"]))
        por_cor, _ = classificar(cores, PALETA, CFG.limiar_incerto, CFG.peso_l)
        self.assertTrue(validar_estado(por_cor).invalidas)
        self.assertEqual(classificar_combinado(cores, PALETA, self.CFG), sol)

    def test_peca_invalida_nos_dois_modos_continua_invalida(self):
        g = grade_vazia()
        for r, c in ((0, 0), (0, 1), (1, 0), (1, 1)):
            g[r][c] = "L"
        estado = validar_estado(classificar_combinado(cores_de(g), PALETA, self.CFG))
        self.assertEqual(estado.pecas["L"].motivo, "4 casas (esperado 5)")


class TestPipelineEModoCor(unittest.TestCase):
    H = calcular_homografia(CANTOS_PADRAO, CFG.largura_px, CFG.altura_px)

    def test_modo_cor_nao_mudou(self):
        sol = next(solucoes())
        quadro = com_ruido(projetar(renderizar(sol)), sigma=4, rng=np.random.default_rng(5))
        pipe = Pipeline(Config(identificacao="cor", quadros_estaveis=1), self.H, PALETA)
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


PALETA_REAL = Paleta.carregar("calibracao/paleta.json")


def hex_de_lab(lab) -> str:
    bgr = cv2.cvtColor(np.array([[lab]], np.float32), cv2.COLOR_LAB2BGR)[0, 0]
    b, g, r = (int(round(float(np.clip(x, 0, 1)) * 255)) for x in bgr)
    return f"#{r:02x}{g:02x}{b:02x}"


CORES_REAIS = {k: hex_de_lab(v) for k, v in PALETA_REAL.cores.items() if k != "."}
PAPEL = hex_de_lab(PALETA_REAL.cores["."])


def misturar(cor_hex: str, fracao: float) -> str:
    """Cor da peça clareada pelo papel (reflexo): fracao 0 = peça, 1 = papel."""
    a = [int(cor_hex[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(PAPEL[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * fracao):02x}" for x, y in zip(a, b))


def topo_real(grade, cores_casa=None, seed=0):
    """Vista de topo com as cores reais; cores_casa troca a cor de casas avulsas."""
    img = renderizar(grade, cores=CORES_REAIS, fundo=PAPEL)
    for (r, c), cor in (cores_casa or {}).items():
        img[r * 100:(r + 1) * 100, c * 100:(c + 1) * 100] = [int(cor[i:i + 2], 16) for i in (5, 3, 1)]
    return com_ruido(img, sigma=3, rng=np.random.default_rng(seed))


def ler_real(grade, cores_casa=None, cfg=Config(), seed=0):
    cores = cores_das_celulas(topo_real(grade, cores_casa, seed), 6, 10, cfg.fracao_central)
    return classificar_forma(cores, PALETA_REAL, cfg), classificar_combinado(cores, PALETA_REAL, cfg), cores


def grade_de(texto: str):
    return [list(l) for l in texto.split("/")]


class TestCasosReais(unittest.TestCase):
    def test_l_da_borda_com_casas_de_cor_diferente(self):
        certa = grade_de("ZZIIIIIFLL/VZYYYYFFFL/VZZYUUUWFL/VVVXUTUWWL/PPXXXTNNWW/PPPXTTTNNN")
        self.assertTrue(validar_estado(certa).vitoria)
        bordas = {(0, 8): CORES_REAIS["Z"], (3, 9): CORES_REAIS["Z"]}
        forma, combinado, cores = ler_real(certa, bordas)
        cor, _ = classificar(cores, PALETA_REAL, CFG.limiar_incerto, CFG.peso_l)
        self.assertEqual((cor[0][8], cor[3][9]), ("Z", "Z"))
        self.assertFalse(validar_estado(cor).vitoria)
        for g in (forma, combinado):
            self.assertEqual(g, certa)
            self.assertTrue(validar_estado(g).vitoria)

    def _i_com_reflexo(self):
        g = colocar_peca(grade_vazia(), "I", ((0, 0), (0, 1), (0, 2), (0, 3), (0, 4)), 0, 0)
        g = colocar_peca(g, "T", ((0, 0), (0, 1), (0, 2), (1, 1), (2, 1)), 1, 0)
        g = colocar_peca(g, "P", ((0, 0), (0, 1), (1, 0), (1, 1), (2, 0)), 1, 3)
        return g, {(0, 4): misturar(CORES_REAIS["I"], 0.6)}

    def test_i_na_linha_0_com_reflexo_encostado_em_t_e_p(self):
        g, reflexo = self._i_com_reflexo()
        forma, combinado, cores = ler_real(g, reflexo)
        d = distancia(cores[0, 4], PALETA_REAL.cores["."], CFG.peso_l)
        self.assertLess(d, CFG.limiar_ocupada - CFG.margem_ocupada)   # a ponta parece vazia
        for resultado in (forma, combinado):
            self.assertEqual(resultado, g)
            self.assertTrue(validar_estado(resultado).pecas["I"].valida)

    def test_tabuleiro_cheio_desde_o_primeiro_quadro_reconhece_o_i(self):
        sol = next(solucoes())
        i = casas_de(sol, "I")
        reflexo = {i[-1]: misturar(CORES_REAIS["I"], 0.6)}
        H = calcular_homografia(CANTOS_PADRAO, CFG.largura_px, CFG.altura_px)
        pipe = Pipeline(Config(), H, PALETA_REAL)
        rng = np.random.default_rng(3)
        msgs = []
        for _ in range(Config().quadros_estaveis):
            topo = renderizar(sol, cores=CORES_REAIS, fundo=PAPEL)
            r, c = i[-1]
            topo[r * 100:(r + 1) * 100, c * 100:(c + 1) * 100] = [int(reflexo[(r, c)][k:k + 2], 16) for k in (5, 3, 1)]
            msgs += pipe.processar(com_ruido(projetar(topo), sigma=3, rng=rng)).mensagens
        primeiro = msgs[0]
        self.assertEqual(primeiro["type"], "board_state")
        self.assertEqual(primeiro["grid"], sol)
        self.assertTrue(pipe.estado_atual.vitoria)

    def test_peca_partida_em_3_e_2_casas_vira_uma_so(self):
        l = ((0, 0), (1, 0), (2, 0), (3, 0), (3, 1))
        g = colocar_peca(grade_vazia(), "L", l, 1, 4)
        lab = PALETA_REAL.cores["L"] + np.array([45, 0, 0], np.float32)
        clara = hex_de_lab(lab)
        partes = {(4, 4): clara, (4, 5): clara}
        forma, combinado, cores = ler_real(g, partes)
        self.assertGreater(distancia(cores[3, 4], cores[4, 4], CFG.peso_l), CFG.limiar_mesma_peca)
        self.assertEqual(forma, g)
        self.assertEqual(combinado, g)

    def test_grupos_de_4_e_7_com_a_paleta_real_continuam_invalidos(self):
        g = grade_vazia()
        for r, c in ((0, 0), (0, 1), (1, 0), (1, 1)):
            g[r][c] = "L"
        for r, c in ((3, 4), (3, 5), (3, 6), (3, 7), (4, 4), (4, 5), (4, 6)):
            g[r][c] = "P"
        for resultado in ler_real(g)[:2]:
            estado = validar_estado(resultado)
            self.assertEqual(estado.pecas["L"].motivo, "4 casas (esperado 5)")
            self.assertEqual(estado.pecas["P"].motivo, "7 casas (esperado 5)")

    def test_tabuleiro_inteiro_num_grupo_so_respeita_o_prazo(self):
        sol = next(solucoes())
        uma_cor = {k: CORES_REAIS["V"] for k in CORES_REAIS}
        img = com_ruido(renderizar(sol, cores=uma_cor, fundo=PAPEL), sigma=3, rng=np.random.default_rng(9))
        cores = cores_das_celulas(img, 6, 10, CFG.fracao_central)
        cfg = Config(tempo_max_forma_ms=40)
        inicio = time.perf_counter()
        classificar_forma(cores, PALETA_REAL, cfg)
        gasto = (time.perf_counter() - inicio) * 1000
        self.assertLess(gasto, cfg.tempo_max_forma_ms + 60)


if __name__ == "__main__":
    unittest.main()
