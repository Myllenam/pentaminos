import time
import unittest

import numpy as np

from config import Config
from encaixes import carregar, melhor_encaixe
from forma import ler_combinado, ler_forma
from localizacao import calcular_homografia
from pentaminos import LETRAS
from pipeline import Pipeline
from sintetico import CANTOS_PADRAO, com_ruido, projetar, renderizar
from tests.test_forma import CORES_REAIS, PALETA_REAL, PAPEL, grade_de, hex_de_lab, ler_real
from validador import validar_estado
from visao import cores_das_celulas

CERTA = grade_de("VVVXIIIIIT/VFXXXNNTTT/VFFXWWNNNT/FFZWWYYYYP/ZZZWLUYUPP/ZLLLLUUUPP")
LIDA = grade_de("VVWXPPIITT/VFXX?NNTTT/ZFFXWWNNNT/FFZWWYYYYP/ZZZWLUYUPP/ZLLLLUUU??")
CFG = Config()
H = calcular_homografia(CANTOS_PADRAO, CFG.largura_px, CFG.altura_px)


def pintar(grade, cores_casa, seed=0):
    img = renderizar(grade, cores=CORES_REAIS, fundo=PAPEL)
    for (r, c), cor in cores_casa.items():
        img[r * 100:(r + 1) * 100, c * 100:(c + 1) * 100] = [int(cor[i:i + 2], 16) for i in (5, 3, 1)]
    return img


def meio(a: str, b: str) -> str:
    return hex_de_lab((PALETA_REAL.cores[a] + PALETA_REAL.cores[b]) / 2)


class TestEncaixes(unittest.TestCase):
    def test_sao_9356_e_todos_vitoriosos(self):
        T = carregar()
        self.assertEqual(T.shape, (9356, 60))
        self.assertEqual(len(np.unique(T, axis=0)), 9356)
        for linha in T[::500]:
            grade = [[LETRAS[i] for i in linha[r * 10:(r + 1) * 10]] for r in range(6)]
            self.assertTrue(validar_estado(grade).vitoria)

    def _caso_real(self):
        trocadas = {}
        for r in range(6):
            for c in range(10):
                if LIDA[r][c] != CERTA[r][c]:
                    trocadas[(r, c)] = meio(CERTA[r][c], "Y" if CERTA[r][c] == "X" else "L") \
                        if LIDA[r][c] == "?" else CORES_REAIS[LIDA[r][c]]
        return trocadas

    def test_caso_real_do_tabuleiro_cheio_sai_certo_e_com_vitoria(self):
        trocadas = self._caso_real()
        self.assertEqual(len(trocadas), 8)
        forma, combinado, cores = ler_real(CERTA, trocadas)
        for grade in (forma, combinado):
            self.assertEqual(grade, CERTA)
            self.assertTrue(validar_estado(grade).vitoria)
        encaixe = melhor_encaixe(cores, PALETA_REAL, CFG)
        self.assertTrue(encaixe.aceito)

    def test_caso_real_pelo_pipeline_publica_a_grade_certa(self):
        trocadas = self._caso_real()
        pipe = Pipeline(CFG, H, PALETA_REAL)
        rng = np.random.default_rng(4)
        msgs = []
        for _ in range(CFG.janela_votos):
            msgs += pipe.processar(com_ruido(projetar(pintar(CERTA, trocadas)), sigma=3, rng=rng)).mensagens
        self.assertEqual(msgs[0]["grid"], CERTA)
        self.assertTrue(pipe.estado_atual.vitoria)
        self.assertNotIn("duvidas", msgs[0])

    def test_sete_casas_com_a_cor_da_vizinha_em_20_tabuleiros(self):
        T = carregar()
        rng = np.random.default_rng(5)
        refs = np.stack([PALETA_REAL.cores[l] for l in LETRAS])
        certos = sem_encaixe = 0
        for _ in range(20):
            g = T[rng.integers(len(T))].reshape(6, 10)
            cores = refs[g] + rng.normal(0, 1.5, (6, 10, 3))
            for _ in range(7):
                r, c = rng.integers(6), rng.integers(10)
                viz = [(r + dr, c + dc) for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
                       if 0 <= r + dr < 6 and 0 <= c + dc < 10 and g[r + dr, c + dc] != g[r, c]]
                if viz:
                    cores[r, c] = refs[g[viz[rng.integers(len(viz))]]]
            certa = [[LETRAS[i] for i in linha] for linha in g]
            certos += ler_forma(cores.astype(np.float32), PALETA_REAL, CFG)[0] == certa
            sem_encaixe += ler_forma(cores.astype(np.float32), PALETA_REAL, Config(margem_encaixe=1e9))[0] == certa
        self.assertEqual(certos, 20)
        self.assertLess(sem_encaixe, 10)

    def test_mao_sobre_o_tabuleiro_cheio_nao_vira_encaixe(self):
        pele = {(r, c): "#d9a07a" for r in range(2, 5) for c in range(2, 7)}
        cores = cores_das_celulas(pintar(CERTA, pele), 6, 10, CFG.fracao_central)
        encaixe = melhor_encaixe(cores, PALETA_REAL, CFG)
        self.assertFalse(encaixe.aceito)
        self.assertTrue(encaixe.discordam)
        self.assertFalse(validar_estado(ler_combinado(cores, PALETA_REAL, CFG)[0]).vitoria)

    def test_custo_por_quadro_fica_abaixo_de_100_ms(self):
        cores = cores_das_celulas(pintar(CERTA, {}), 6, 10, CFG.fracao_central)
        melhor_encaixe(cores, PALETA_REAL, CFG)
        inicio = time.perf_counter()
        for _ in range(20):
            melhor_encaixe(cores, PALETA_REAL, CFG)
        self.assertLess((time.perf_counter() - inicio) / 20 * 1000, 100)

    def _quase_empate(self):
        T = carregar()
        diferem = (T != T[0]).sum(axis=1)
        diferem[0] = 99
        outro = int(diferem.argmin())
        casas = [i for i in range(60) if T[0, i] != T[outro, i]]
        grade = [[LETRAS[i] for i in T[0, r * 10:(r + 1) * 10]] for r in range(6)]
        meios = {(i // 10, i % 10): meio(LETRAS[T[0, i]], LETRAS[T[outro, i]]) for i in casas}
        return grade, meios

    def test_dois_encaixes_quase_empatados_nao_sao_aceitos(self):
        grade, meios = self._quase_empate()
        cores = cores_das_celulas(pintar(grade, meios), 6, 10, CFG.fracao_central)
        encaixe = melhor_encaixe(cores, PALETA_REAL, CFG)
        self.assertFalse(encaixe.aceito)
        self.assertEqual(encaixe.discordam, set(meios))
        _, disputadas = ler_combinado(cores, PALETA_REAL, CFG)
        self.assertEqual(disputadas, set(meios))

    def test_empate_vira_duvida_depois_do_tempo(self):
        grade, meios = self._quase_empate()
        pipe = Pipeline(Config(max_incertas_mao=60), H, PALETA_REAL)   # cor do meio dá muitas "?"
        rng = np.random.default_rng(6)
        msgs = []
        for i in range(20):
            quadro = com_ruido(projetar(pintar(grade, meios)), sigma=3, rng=rng)
            msgs += pipe.processar(quadro, ts=1, agora=i * 0.5).mensagens
        com_duvida = [m for m in msgs if m.get("duvidas")]
        self.assertTrue(com_duvida)
        antes = [m for m in msgs if m["type"] == "board_state" and not m.get("duvidas")]
        self.assertTrue(antes)
        celulas = {tuple(c) for d in com_duvida[-1]["duvidas"] for c in d["cells"]}
        self.assertTrue(set(meios) <= celulas)

    def test_correcao_restringe_os_encaixes(self):
        grade, meios = self._quase_empate()
        cores = cores_das_celulas(pintar(grade, meios), 6, 10, CFG.fracao_central)
        letra = grade[min(meios)[0]][min(meios)[1]]
        casas = tuple((r, c) for r in range(6) for c in range(10) if grade[r][c] == letra)
        encaixe = melhor_encaixe(cores, PALETA_REAL, CFG, {letra: casas})
        self.assertEqual(encaixe.grade[casas[0][0]][casas[0][1]], letra)
        self.assertTrue(all(encaixe.grade[r][c] == letra for r, c in casas))


if __name__ == "__main__":
    unittest.main()
