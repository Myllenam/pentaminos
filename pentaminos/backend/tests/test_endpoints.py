import pytest

from app import services


def criar(client, **campos):
    corpo = {"jogador": "Ana", "modo": "digital", "pecas": 6, **campos}
    resposta = client.post("/sessions", json=corpo)
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def grade(linhas=6, colunas=10):
    return [["."] * colunas for _ in range(linhas)]


# --- /health --------------------------------------------------------------

def test_health(client):
    resposta = client.get("/health")

    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_cors_libera_o_front_local(client):
    resposta = client.options(
        "/sessions",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert resposta.status_code == 200
    assert resposta.headers["access-control-allow-origin"] == "http://localhost:3000"


# --- POST /sessions -------------------------------------------------------

def test_cria_sessao(client):
    resposta = client.post("/sessions", json={"jogador": "  Ana ", "modo": "fisico", "pecas": 12})

    assert resposta.status_code == 201
    s = resposta.json()
    assert s["id"]
    assert (s["jogador"], s["modo"], s["pecas"]) == ("Ana", "fisico", 12)
    assert s["status"] == "em_andamento"
    assert s["numero_jogadas"] == 0 and s["dicas_usadas"] == 0
    assert s["finalizada_em"] is None and s["tempo_total_s"] is None
    assert s["tabuleiro_final"] is None
    assert s["iniciada_em"].endswith(("Z", "+00:00"))


@pytest.mark.parametrize(
    "campos",
    [
        {"pecas": 0},
        {"pecas": 13},
        {"pecas": "doze"},
        {"modo": "online"},
        {"jogador": ""},
        {"jogador": "   "},
        {"jogador": "x" * 41},
    ],
)
def test_cria_sessao_recusa_dados_invalidos(client, campos):
    corpo = {"jogador": "Ana", "modo": "digital", "pecas": 6, **campos}

    assert client.post("/sessions", json=corpo).status_code == 422


def test_cria_sessao_recusa_corpo_incompleto(client):
    assert client.post("/sessions", json={"jogador": "Ana"}).status_code == 422


# --- GET /sessions --------------------------------------------------------

def test_lista_vazia(client):
    assert client.get("/sessions").json() == []


def test_lista_e_filtra(client):
    ana6 = criar(client, jogador="Ana", modo="digital", pecas=6)
    criar(client, jogador="Bia", modo="fisico", pecas=6)
    criar(client, jogador="Ana", modo="fisico", pecas=12)
    client.post(f"/sessions/{ana6['id']}/abandon")

    def ids(**params):
        return {s["id"] for s in client.get("/sessions", params=params).json()}

    assert len(ids()) == 3
    assert len(ids(jogador="Ana")) == 2
    assert len(ids(modo="fisico")) == 2
    assert len(ids(pecas=6)) == 2
    assert ids(status="abandonada") == {ana6["id"]}
    assert len(ids(jogador="Ana", modo="fisico", pecas=12, status="em_andamento")) == 1
    assert ids(jogador="Zé") == set()


def test_lista_recusa_filtro_invalido(client):
    assert client.get("/sessions", params={"modo": "x"}).status_code == 422
    assert client.get("/sessions", params={"status": "x"}).status_code == 422
    assert client.get("/sessions", params={"pecas": "x"}).status_code == 422


# --- GET /sessions/{id} ---------------------------------------------------

def test_detalhe_traz_jogadas_ordenadas(client, db, mensagens_demo):
    sessao = criar(client, modo="fisico", pecas=12)
    for m in mensagens_demo:
        if m["type"] != "board_state":
            services.registrar_evento(db, {**m, "session": sessao["id"]})

    resposta = client.get(f"/sessions/{sessao['id']}")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["numero_jogadas"] == 13
    assert [j["sequencia"] for j in corpo["jogadas"]] == list(range(1, 15))
    primeira = corpo["jogadas"][0]
    assert (primeira["tipo"], primeira["peca"], primeira["valida"]) == ("piece_placed", "F", True)
    assert primeira["casas"] == [[3, 2], [4, 2], [4, 3], [5, 1], [5, 2]]


def test_detalhe_de_sessao_sem_jogadas(client):
    sessao = criar(client)

    assert client.get(f"/sessions/{sessao['id']}").json()["jogadas"] == []


def test_detalhe_404(client):
    resposta = client.get("/sessions/nao-existe")

    assert resposta.status_code == 404
    assert "não encontrada" in resposta.json()["detail"]


# --- POST /sessions/{id}/finish -------------------------------------------

def test_finish_marca_vencida_e_guarda_o_tabuleiro(client, grade_vencedora):
    sessao = criar(client, modo="fisico", pecas=12)

    resposta = client.post(
        f"/sessions/{sessao['id']}/finish", json={"tabuleiro_final": grade_vencedora}
    )

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["status"] == "vencida"
    assert corpo["tabuleiro_final"] == grade_vencedora
    assert corpo["finalizada_em"] is not None
    assert isinstance(corpo["tempo_total_s"], int) and corpo["tempo_total_s"] >= 0
    # O que foi gravado é o que volta no GET.
    assert client.get(f"/sessions/{sessao['id']}").json()["status"] == "vencida"


def test_finish_calcula_o_tempo_total(client, db):
    sessao = criar(client)
    registro = services.buscar_sessao(db, sessao["id"])
    registro.iniciada_em = registro.iniciada_em.replace(year=registro.iniciada_em.year - 1)
    db.commit()

    corpo = client.post(
        f"/sessions/{sessao['id']}/finish", json={"tabuleiro_final": grade()}
    ).json()

    assert corpo["tempo_total_s"] >= 365 * 24 * 3600


@pytest.mark.parametrize(
    "tabuleiro",
    [grade(linhas=5), grade(colunas=9), [["Q"] * 10 for _ in range(6)]],
)
def test_finish_recusa_tabuleiro_invalido(client, tabuleiro):
    sessao = criar(client)

    resposta = client.post(f"/sessions/{sessao['id']}/finish", json={"tabuleiro_final": tabuleiro})

    assert resposta.status_code == 422
    assert client.get(f"/sessions/{sessao['id']}").json()["status"] == "em_andamento"


def test_finish_sem_corpo_e_422(client):
    sessao = criar(client)

    assert client.post(f"/sessions/{sessao['id']}/finish", json={}).status_code == 422


def test_finish_404(client):
    resposta = client.post("/sessions/nao-existe/finish", json={"tabuleiro_final": grade()})

    assert resposta.status_code == 404


def test_finish_duas_vezes_e_409(client):
    sessao = criar(client)
    client.post(f"/sessions/{sessao['id']}/finish", json={"tabuleiro_final": grade()})

    resposta = client.post(f"/sessions/{sessao['id']}/finish", json={"tabuleiro_final": grade()})

    assert resposta.status_code == 409
    assert "vencida" in resposta.json()["detail"]


# --- POST /sessions/{id}/abandon ------------------------------------------

def test_abandon(client):
    sessao = criar(client)

    resposta = client.post(f"/sessions/{sessao['id']}/abandon")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["status"] == "abandonada"
    assert corpo["finalizada_em"] is not None
    assert corpo["tabuleiro_final"] is None


def test_abandon_404(client):
    assert client.post("/sessions/nao-existe/abandon").status_code == 404


def test_abandon_depois_de_encerrada_e_409(client):
    sessao = criar(client)
    client.post(f"/sessions/{sessao['id']}/abandon")

    assert client.post(f"/sessions/{sessao['id']}/abandon").status_code == 409


# --- /calibration ---------------------------------------------------------

PALETA = {".": [60.1, 0.5, 1.2], "F": [45.0, 60.2, 40.1], "I": [30.0, -20.5, 10.0]}
HOMOGRAFIA = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.001, 0.002, 1.0]]


def test_latest_sem_calibracao_e_404(client):
    resposta = client.get("/calibration/latest")

    assert resposta.status_code == 404
    assert "calibração" in resposta.json()["detail"]


def test_salva_calibracao_com_homografia(client):
    resposta = client.post("/calibration", json={"paleta": PALETA, "homografia": HOMOGRAFIA})

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["id"] >= 1
    assert corpo["paleta"] == PALETA
    assert corpo["homografia"] == HOMOGRAFIA
    assert corpo["criada_em"]


def test_salva_calibracao_sem_homografia(client):
    resposta = client.post("/calibration", json={"paleta": PALETA})

    assert resposta.status_code == 201
    assert resposta.json()["homografia"] is None


def test_latest_devolve_a_mais_recente(client):
    client.post("/calibration", json={"paleta": {".": [1, 2, 3]}})
    segunda = client.post("/calibration", json={"paleta": PALETA, "homografia": HOMOGRAFIA}).json()

    resposta = client.get("/calibration/latest")

    assert resposta.status_code == 200
    assert resposta.json()["id"] == segunda["id"]
    assert resposta.json()["paleta"] == PALETA


@pytest.mark.parametrize(
    "corpo",
    [
        {},
        {"paleta": {}},
        {"paleta": {"Q": [1, 2, 3]}},
        {"paleta": {"F": [1, 2]}},
        {"paleta": {"F": [1, 2, "x"]}},
        {"paleta": PALETA, "homografia": [[1, 0, 0], [0, 1, 0]]},
        {"paleta": PALETA, "homografia": [[1, 0], [0, 1], [0, 0]]},
    ],
)
def test_calibracao_invalida_e_422(client, corpo):
    assert client.post("/calibration", json=corpo).status_code == 422
    assert client.get("/calibration/latest").status_code == 404
