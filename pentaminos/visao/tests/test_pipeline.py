import itertools
import unittest

import numpy as np

from config import Config, carregar_config
from gerar_solucoes import solucoes
from localizacao import calcular_homografia
from pipeline import Pipeline
from sintetico import (CANTOS_PADRAO, CORES_APP, FUNDO_MDF, colocar_peca, com_mao,
                       com_ruido, grade_vazia, projetar, renderizar)
from visao import Paleta

CFG = Config()
H = calcular_homografia(CANTOS_PADRAO, CFG.largura_px, CFG.altura_px)
PALETA = Paleta.de_hex(CORES_APP, FUNDO_MDF)


def quadro(grade, rng, mao=None):
    f = com_ruido(projetar(renderizar(grade)), sigma=4, rng=rng)
    return com_mao(f, *mao) if mao else f


def estados_progressivos(solucao):
    """Tabuleiro com 0, 1, 2 ... 12 peças colocadas (na ordem das letras)."""
    letras = sorted({x for l in solucao for x in l if x != "."})
    estados = [grade_vazia()]
    for i in range(1, len(letras) + 1):
        ativos = set(letras[:i])
        estados.append([[x if x in ativos else "." for x in l] for l in solucao])
    return estados


class TestPipeline(unittest.TestCase):
    def test_partida_completa_gera_12_pecas_e_vitoria(self):
        rng = np.random.default_rng(1)
        sol = next(solucoes(espelhar=False))
        pipe = Pipeline(CFG, H, PALETA, sessao="teste")
        mensagens, descartados = [], 0
        for estado in estados_progressivos(sol):
            for pos in [(420, 200), (480, 260)]:
                r = pipe.processar(quadro(estado, rng, mao=pos))
                descartados += r.descartado
                mensagens += r.mensagens
            for _ in range(4):
                r = pipe.processar(quadro(estado, rng))
                mensagens += r.mensagens
        colocadas = [m for m in mensagens if m["type"] == "piece_placed"]
        self.assertEqual(sorted(m["piece"] for m in colocadas), sorted("FILNPTUVWXYZ"))
        self.assertTrue(all(m["valid"] for m in colocadas))
        self.assertTrue(pipe.estado_atual.vitoria)
        self.assertGreaterEqual(descartados, 12)   
        self.assertEqual(mensagens[0]["type"], "board_state")
        self.assertEqual(mensagens[0]["session"], "teste")

    def test_mao_sozinha_nao_publica_nada(self):
        rng = np.random.default_rng(2)
        pipe = Pipeline(CFG, H, PALETA)
        for _ in range(10):
            r = pipe.processar(quadro(grade_vazia(), rng, mao=(500, 250)))
            self.assertEqual(r.mensagens, [])

    def test_remover_peca_gera_evento(self):
        rng = np.random.default_rng(3)
        sol = next(solucoes(espelhar=False))
        estados = estados_progressivos(sol)
        pipe = Pipeline(CFG, H, PALETA)
        msgs = []
        for estado in (estados[2], estados[1]):          
            for _ in range(4):
                msgs += pipe.processar(quadro(estado, rng)).mensagens
        tipos = [m["type"] for m in msgs if m["type"] != "board_state"]
        self.assertEqual(tipos, ["piece_placed", "piece_placed", "piece_removed"])

    def test_config_json(self):
        import json, tempfile, os
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "c.json")
            with open(p, "w") as f:
                f.write(json.dumps({"quadros_estaveis": 5, "espelhar": False}))
            cfg = carregar_config(p)
            self.assertEqual((cfg.quadros_estaveis, cfg.espelhar, cfg.largura_px), (5, False, 1000))
            with open(p, "w") as f:
                f.write(json.dumps({"nao_existe": 1}))
            with self.assertRaises(ValueError):
                carregar_config(p)


if __name__ == "__main__":
    unittest.main()
