import pytest

from app import services
from app.services import ConflitoDeEstado, DadosInvalidos, NaoEncontrado


def nova_sessao(db, **extra):
    return services.criar_sessao(db, "Ana", "fisico", extra.get("pecas", 12))


def evento(sessao_id, **campos):
    base = {
        "type": "piece_placed",
        "session": sessao_id,
        "ts": 1793141068,
        "piece": "F",
        "cells": [[3, 2], [4, 2], [4, 3], [5, 1], [5, 2]],
        "valid": True,
    }
    base.update(campos)
    return base


# --- com mensagens reais do demo_sintetico.py -----------------------------

def eventos_de_peca(mensagens, sessao_id):
    return [
        {**m, "session": sessao_id}
        for m in mensagens
        if m["type"] in ("piece_placed", "piece_removed")
    ]


def test_registra_todas_as_mensagens_reais_do_demo(db, mensagens_demo):
    sessao = nova_sessao(db)
    eventos = eventos_de_peca(mensagens_demo, sessao.id)

    for m in eventos:
        services.registrar_evento(db, m)

    db.refresh(sessao)
    colocadas = sum(m["type"] == "piece_placed" for m in eventos)
    assert colocadas == 13  # 12 peças + a recolocação da I
    assert len(sessao.jogadas) == len(eventos) == 14
    assert [j.sequencia for j in sessao.jogadas] == list(range(1, 15))
    # numero_jogadas conta só piece_placed.
    assert sessao.numero_jogadas == colocadas


def test_primeira_jogada_real_guarda_os_campos_da_mensagem(db, mensagens_demo):
    sessao = nova_sessao(db)
    primeira = eventos_de_peca(mensagens_demo, sessao.id)[0]

    jogada = services.registrar_evento(db, primeira)

    assert (jogada.tipo, jogada.peca, jogada.valida) == ("piece_placed", "F", True)
    assert jogada.casas == [[3, 2], [4, 2], [4, 3], [5, 1], [5, 2]]
    assert int(jogada.ts.timestamp()) == primeira["ts"]
    assert jogada.sequencia == 1


def test_remocao_real_nao_incrementa_numero_jogadas(db, mensagens_demo):
    sessao = nova_sessao(db)
    remocao = next(m for m in mensagens_demo if m["type"] == "piece_removed")

    services.registrar_evento(db, {**remocao, "session": sessao.id})

    db.refresh(sessao)
    assert sessao.numero_jogadas == 0
    assert sessao.jogadas[0].tipo == "piece_removed"


def test_finaliza_com_a_grade_vencedora_do_demo(db, grade_vencedora):
    sessao = nova_sessao(db)

    resultado = services.finalizar_sessao(db, sessao.id, grade_vencedora)

    assert resultado.status == "vencida"
    assert resultado.tabuleiro_final == grade_vencedora
    assert resultado.finalizada_em is not None
    assert resultado.tempo_total_s >= 0


# --- validações de registrar_evento ---------------------------------------

@pytest.mark.parametrize(
    "campos",
    [
        {"type": "board_state"},
        {"type": None},
        {"session": None},
        {"session": ""},
        {"piece": "A"},
        {"piece": "f"},
        {"cells": []},
        {"cells": None},
        {"cells": [[0, 0, 0]]},
        {"cells": [[0, "a"]]},
        {"cells": [[True, 0]]},
        {"cells": [[6, 0]]},
        {"cells": [[0, 10]]},
        {"cells": [[-1, 0]]},
        {"valid": "sim"},
        {"valid": None},
        {"ts": "ontem"},
        {"ts": 10**30},
    ],
)
def test_evento_invalido_e_recusado_sem_gravar(db, campos):
    sessao = nova_sessao(db)

    with pytest.raises(DadosInvalidos):
        services.registrar_evento(db, evento(sessao.id, **campos))

    db.refresh(sessao)
    assert sessao.jogadas == []
    assert sessao.numero_jogadas == 0


def test_evento_que_nao_e_objeto_e_recusado(db):
    with pytest.raises(DadosInvalidos):
        services.registrar_evento(db, [1, 2, 3])


def test_evento_de_sessao_inexistente(db):
    with pytest.raises(NaoEncontrado):
        services.registrar_evento(db, evento("nao-existe"))


def test_evento_em_sessao_abandonada_e_recusado(db):
    sessao = nova_sessao(db)
    services.abandonar_sessao(db, sessao.id)

    with pytest.raises(ConflitoDeEstado):
        services.registrar_evento(db, evento(sessao.id))


def test_evento_em_sessao_vencida_e_recusado(db):
    sessao = nova_sessao(db)
    services.finalizar_sessao(db, sessao.id, [["."] * 10 for _ in range(6)])

    with pytest.raises(ConflitoDeEstado):
        services.registrar_evento(db, evento(sessao.id))


def test_evento_sem_ts_usa_a_hora_atual(db):
    sessao = nova_sessao(db)
    mensagem = evento(sessao.id)
    del mensagem["ts"]

    jogada = services.registrar_evento(db, mensagem)

    assert jogada.ts.tzinfo is not None


def test_sequencia_e_independente_por_sessao(db):
    a, b = nova_sessao(db), nova_sessao(db)

    services.registrar_evento(db, evento(a.id))
    services.registrar_evento(db, evento(a.id))
    jogada_b = services.registrar_evento(db, evento(b.id))

    assert jogada_b.sequencia == 1


# --- finalizar / abandonar ------------------------------------------------

def grade(linhas=6, colunas=10, valor="."):
    return [[valor] * colunas for _ in range(linhas)]


def test_finalizar_aceita_ponto_e_null_nas_casas_vazias(db):
    sessao = nova_sessao(db)
    g = grade()
    g[0][0] = None

    assert services.finalizar_sessao(db, sessao.id, g).status == "vencida"


@pytest.mark.parametrize(
    "ruim",
    [grade(linhas=5), grade(colunas=9), grade(linhas=7), "x", None, grade(valor="?"),
     grade(valor="AB")],
)
def test_finalizar_recusa_grade_invalida_e_mantem_a_sessao_aberta(db, ruim):
    sessao = nova_sessao(db)

    with pytest.raises(DadosInvalidos):
        services.finalizar_sessao(db, sessao.id, ruim)

    db.refresh(sessao)
    assert sessao.status == "em_andamento"
    assert sessao.tabuleiro_final is None


def test_finalizar_duas_vezes_da_conflito(db):
    sessao = nova_sessao(db)
    services.finalizar_sessao(db, sessao.id, grade())

    with pytest.raises(ConflitoDeEstado):
        services.finalizar_sessao(db, sessao.id, grade())


def test_finalizar_sessao_inexistente(db):
    with pytest.raises(NaoEncontrado):
        services.finalizar_sessao(db, "nada", grade())


def test_abandonar_marca_status_e_tempo(db):
    sessao = nova_sessao(db)

    resultado = services.abandonar_sessao(db, sessao.id)

    assert resultado.status == "abandonada"
    assert resultado.finalizada_em is not None
    assert resultado.tempo_total_s >= 0


def test_abandonar_sessao_ja_vencida_da_conflito(db):
    sessao = nova_sessao(db)
    services.finalizar_sessao(db, sessao.id, grade())

    with pytest.raises(ConflitoDeEstado):
        services.abandonar_sessao(db, sessao.id)
