import unittest

from estabilizacao import Estabilizador

A = [["."] * 3]
B = [["F"] * 3]


class TestEstabilizador(unittest.TestCase):
    def test_publica_so_apos_3_quadros_iguais(self):
        e = Estabilizador(3)
        self.assertIsNone(e.atualizar(A))
        self.assertIsNone(e.atualizar(A))
        self.assertEqual(e.atualizar(A), A)

    def test_nao_republica_o_mesmo_estado(self):
        e = Estabilizador(3)
        for _ in range(3):
            e.atualizar(A)
        for _ in range(5):
            self.assertIsNone(e.atualizar(A))

    def test_mudanca_reinicia_contagem(self):
        e = Estabilizador(3)
        e.atualizar(A); e.atualizar(A)
        self.assertIsNone(e.atualizar(B))      
        self.assertIsNone(e.atualizar(B))
        self.assertEqual(e.atualizar(B), B)

    def test_quadro_descartado_zera_a_contagem(self):
        e = Estabilizador(3)
        e.atualizar(A); e.atualizar(A)
        e.atualizar(None)                      
        self.assertIsNone(e.atualizar(A))
        self.assertIsNone(e.atualizar(A))
        self.assertEqual(e.atualizar(A), A)

    def test_volta_ao_estado_anterior_e_publicada(self):
        e = Estabilizador(2)
        e.atualizar(A); e.atualizar(A)
        e.atualizar(B); self.assertEqual(e.atualizar(B), B)
        e.atualizar(A); self.assertEqual(e.atualizar(A), A)

    def test_quadros_invalido(self):
        with self.assertRaises(ValueError):
            Estabilizador(0)


if __name__ == "__main__":
    unittest.main()
