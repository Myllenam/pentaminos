import unittest
from config import Config
from loop_ao_vivo import FonteSintetica


class TestFonteSintetica(unittest.TestCase):
    def test_fonte_sintetica_entrega_quadros_de_camera(self):
        fonte = FonteSintetica(Config())
        ok, quadro = fonte.read()
        self.assertTrue(ok)
        self.assertEqual(quadro.shape, (960, 1280, 3))
        self.assertEqual(quadro.dtype.name, "uint8")
        fonte.release()

    def test_fonte_sintetica_reinicia_a_sequencia(self):
        fonte = FonteSintetica(Config())
        total = len(fonte.frames)
        for _ in range(total):
            ok, _ = fonte.read()
            self.assertTrue(ok)
        primeiro_ciclo = fonte.i
        fonte.read()
        self.assertEqual(fonte.i, primeiro_ciclo + 1)
        self.assertGreater(total, 50)


if __name__ == "__main__":
    unittest.main()
