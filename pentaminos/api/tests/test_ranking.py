import unittest

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, criar_engine, get_session
from main import app


def resultado(**campos):
    base = {
        "player": "Ana",
        "time": "01:30",
        "pieces": 3,
        "moves": 5,
        "date": "27/10",
        "mode": "digital",
        "placements": [
            {"order": 1, "shapeId": "I", "rotation": 0, "origin": [0, 0]},
        ],
        "finalBoard": [["I", "I", "I", "I", "I"], [None] * 5, [None] * 5],
    }
    base.update(campos)
    return base


class TestRanking(unittest.TestCase):
    def setUp(self):
        # Banco em memória, isolado para cada teste.
        engine = criar_engine("sqlite://", poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        Sessao = sessionmaker(bind=engine, autoflush=False)

        def sessao_de_teste():
            session = Sessao()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_session] = sessao_de_teste
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_salva_e_devolve_em_camel_case(self):
        resposta = self.client.post("/ranking", json=resultado())

        self.assertEqual(resposta.status_code, 201)
        corpo = resposta.json()
        self.assertTrue(corpo["id"])
        self.assertEqual(corpo["mode"], "digital")
        self.assertEqual(corpo["placements"][0]["shapeId"], "I")
        self.assertEqual(corpo["finalBoard"][0][0], "I")

    def test_recusa_solucao_automatica(self):
        resposta = self.client.post("/ranking", json=resultado(autoSolved=True))

        self.assertEqual(resposta.status_code, 422)
        self.assertEqual(self.client.get("/ranking").json(), [])

    def test_recusa_dados_invalidos(self):
        for campos in (
            {"pieces": 2},
            {"mode": "outro"},
            {"time": "1:5"},
            {"player": "   "},
        ):
            with self.subTest(campos=campos):
                resposta = self.client.post("/ranking", json=resultado(**campos))
                self.assertEqual(resposta.status_code, 422)

    def test_filtra_por_pecas_e_modo(self):
        self.client.post("/ranking", json=resultado(player="A"))
        self.client.post("/ranking", json=resultado(player="B", mode="fisico"))
        self.client.post("/ranking", json=resultado(player="C", pieces=4))

        resposta = self.client.get("/ranking", params={"pieces": 3, "mode": "fisico"})

        self.assertEqual([e["player"] for e in resposta.json()], ["B"])

    def test_ordena_por_tempo_e_desempata_por_movimentos(self):
        self.client.post("/ranking", json=resultado(player="lento", time="02:00", moves=1))
        self.client.post("/ranking", json=resultado(player="rapido", time="00:50", moves=9))
        self.client.post("/ranking", json=resultado(player="empate", time="00:50", moves=3))

        jogadores = [e["player"] for e in self.client.get("/ranking").json()]

        self.assertEqual(jogadores, ["empate", "rapido", "lento"])

    def test_ordena_por_movimentos(self):
        self.client.post("/ranking", json=resultado(player="lento", time="02:00", moves=1))
        self.client.post("/ranking", json=resultado(player="rapido", time="00:50", moves=9))

        resposta = self.client.get("/ranking", params={"sortBy": "moves"})

        self.assertEqual([e["player"] for e in resposta.json()], ["lento", "rapido"])

    def test_ordena_tempo_acima_de_uma_hora(self):
        # "100:00" vem depois de "59:59" (ordem numérica, não de texto).
        self.client.post("/ranking", json=resultado(player="longo", time="100:00"))
        self.client.post("/ranking", json=resultado(player="curto", time="59:59"))

        jogadores = [e["player"] for e in self.client.get("/ranking").json()]

        self.assertEqual(jogadores, ["curto", "longo"])

    def test_limpa_ranking(self):
        self.client.post("/ranking", json=resultado())

        self.assertEqual(self.client.delete("/ranking").status_code, 204)
        self.assertEqual(self.client.get("/ranking").json(), [])


if __name__ == "__main__":
    unittest.main()
