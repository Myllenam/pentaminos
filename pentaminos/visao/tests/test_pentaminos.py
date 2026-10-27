import unittest

from pentaminos import (FORMAS_BASE, LETRAS, conexa, espelhar_horizontal,
                        forma_corresponde, orientacoes)


class TestOrientacoes(unittest.TestCase):
    def test_total_com_espelhamento_sao_63(self):
        self.assertEqual(sum(len(orientacoes(l, True)) for l in LETRAS), 63)

    def test_total_so_rotacao_sao_41(self):
        self.assertEqual(sum(len(orientacoes(l, False)) for l in LETRAS), 41)

    def test_orientacoes_por_peca(self):
        esperado_com = dict(F=8, I=2, L=8, N=8, P=8, T=4, U=4, V=4, W=4, X=1, Y=8, Z=4)
        esperado_sem = dict(F=4, I=2, L=4, N=4, P=4, T=4, U=4, V=4, W=4, X=1, Y=4, Z=2)
        for l in LETRAS:
            self.assertEqual(len(orientacoes(l, True)), esperado_com[l], l)
            self.assertEqual(len(orientacoes(l, False)), esperado_sem[l], l)

    def test_so_seis_pecas_mudam_com_espelhamento(self):
        mudam = {l for l in LETRAS if len(orientacoes(l, True)) != len(orientacoes(l, False))}
        self.assertEqual(mudam, set("FLNPYZ"))

    def test_peca_espelhada_so_vale_com_espelhamento(self):
        for l in "FLNPYZ":
            esp = espelhar_horizontal(FORMAS_BASE[l])
            self.assertTrue(forma_corresponde(l, esp, espelhar=True), l)
            self.assertFalse(forma_corresponde(l, esp, espelhar=False), l)

    def test_pecas_simetricas_nao_mudam(self):
        for l in "ITUVWX":
            esp = espelhar_horizontal(FORMAS_BASE[l])
            self.assertTrue(forma_corresponde(l, esp, espelhar=False), l)

    def test_forma_em_qualquer_posicao(self):
        deslocada = [(r + 3, c + 7) for r, c in FORMAS_BASE["T"]]
        self.assertTrue(forma_corresponde("T", deslocada))

    def test_forma_errada_e_tamanho_errado(self):
        self.assertFalse(forma_corresponde("T", FORMAS_BASE["L"]))
        self.assertFalse(forma_corresponde("T", list(FORMAS_BASE["T"])[:4]))

    def test_conexa(self):
        self.assertTrue(conexa(FORMAS_BASE["F"]))
        self.assertFalse(conexa([(0, 0), (0, 1), (5, 5), (5, 6), (6, 6)]))
        self.assertFalse(conexa([(0, 0), (1, 1)]))  # só diagonal não conta


if __name__ == "__main__":
    unittest.main()
