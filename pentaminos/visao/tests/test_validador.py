import itertools
import unittest

from gerar_solucoes import solucoes
from pentaminos import FORMAS_BASE, LETRAS, espelhar_horizontal
from sintetico import colocar_peca, grade_vazia
from validador import diferencas, validar_estado


class TestValidador(unittest.TestCase):
    def test_solucoes_completas_dao_vitoria(self):
        for g in itertools.islice(solucoes(espelhar=True), 3):
            r = validar_estado(g, espelhar=True)
            self.assertTrue(r.vitoria)
            self.assertEqual(r.invalidas, [])

    def test_solucoes_so_rotacao_valem_nas_duas_regras(self):
        for g in itertools.islice(solucoes(espelhar=False), 3):
            self.assertTrue(validar_estado(g, espelhar=False).vitoria)
            self.assertTrue(validar_estado(g, espelhar=True).vitoria)

    def test_tabuleiro_vazio(self):
        r = validar_estado(grade_vazia())
        self.assertFalse(r.vitoria)
        self.assertEqual((r.vazias, r.incertas, len(r.pecas)), (60, 0, 0))

    def test_peca_espelhada_depende_da_regra(self):
        g = colocar_peca(grade_vazia(), "F", espelhar_horizontal(FORMAS_BASE["F"]), 0, 0)
        self.assertTrue(validar_estado(g, espelhar=True).pecas["F"].valida)
        r = validar_estado(g, espelhar=False)
        self.assertFalse(r.pecas["F"].valida)
        self.assertIn("forma", r.pecas["F"].motivo)

    def test_peca_com_4_casas(self):
        g = colocar_peca(grade_vazia(), "T", FORMAS_BASE["T"], 0, 0)
        g[0][0] = "."
        p = validar_estado(g).pecas["T"]
        self.assertFalse(p.valida)
        self.assertIn("4 casas", p.motivo)

    def test_casas_nao_conectadas(self):
        g = grade_vazia()
        for r, c in [(0, 0), (0, 1), (5, 8), (5, 9), (4, 9)]:
            g[r][c] = "P"
        self.assertEqual(validar_estado(g).pecas["P"].motivo, "casas não conectadas")

    def test_forma_de_outra_peca(self):
        g = colocar_peca(grade_vazia(), "L", FORMAS_BASE["T"], 0, 0)
        self.assertFalse(validar_estado(g).pecas["L"].valida)

    def test_letra_desconhecida(self):
        g = colocar_peca(grade_vazia(), "Q", FORMAS_BASE["T"], 0, 0)
        self.assertEqual(validar_estado(g).pecas["Q"].motivo, "peça desconhecida")

    def test_casa_incerta_impede_vitoria(self):
        g = next(solucoes(espelhar=False))
        g[2][3] = "?"
        r = validar_estado(g)
        self.assertFalse(r.vitoria)
        self.assertEqual(r.incertas, 1)

    def test_troca_de_casas_entre_pecas_nao_e_vitoria(self):
        g = next(solucoes(espelhar=False))
        for r in range(6):
            for c in range(9):
                if g[r][c] != g[r][c + 1]:
                    g[r][c], g[r][c + 1] = g[r][c + 1], g[r][c]
                    self.assertFalse(validar_estado(g).vitoria)
                    return
        self.fail("não achei fronteira entre peças")

    def test_pecas_esperadas_menores(self):
        g = [["I"] * 5]
        self.assertTrue(validar_estado(g, pecas_esperadas=("I",)).pecas["I"].valida)
        self.assertTrue(validar_estado(g, pecas_esperadas=("I",)).vitoria)


class TestEventos(unittest.TestCase):
    def setUp(self):
        self.vazio = validar_estado(grade_vazia())
        g = colocar_peca(grade_vazia(), "T", FORMAS_BASE["T"], 0, 0)
        self.com_t = validar_estado(g)
        g2 = colocar_peca(grade_vazia(), "T", FORMAS_BASE["T"], 3, 5)
        self.t_movido = validar_estado(g2)

    def test_primeiro_estado_sem_evento(self):
        self.assertEqual(diferencas(None, self.vazio), [])

    def test_colocar_e_remover(self):
        ev = diferencas(self.vazio, self.com_t)
        self.assertEqual([(e.tipo, e.peca, e.valida) for e in ev], [("piece_placed", "T", True)])
        ev = diferencas(self.com_t, self.vazio)
        self.assertEqual([(e.tipo, e.peca) for e in ev], [("piece_removed", "T")])

    def test_mover_gera_remocao_e_colocacao(self):
        ev = diferencas(self.com_t, self.t_movido)
        self.assertEqual([e.tipo for e in ev], ["piece_removed", "piece_placed"])

    def test_sem_mudanca_sem_eventos(self):
        self.assertEqual(diferencas(self.com_t, self.com_t), [])


if __name__ == "__main__":
    unittest.main()
