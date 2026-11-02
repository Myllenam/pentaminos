V = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]


def test_assign_piece_do_navegador_chega_na_visao(client):
    with client.websocket_connect("/ws/sessions/s1?role=vision") as visao, \
            client.websocket_connect("/ws/sessions/s1") as navegador:
        navegador.send_json({"type": "assign_piece", "cells": V, "piece": "V"})
        assert visao.receive_json() == {"type": "assign_piece", "session": "s1", "cells": V, "piece": "V"}


def test_assign_piece_invalido_recebe_error(client):
    with client.websocket_connect("/ws/sessions/s1") as navegador:
        navegador.send_json({"type": "assign_piece", "cells": V[:4], "piece": "V"})
        assert navegador.receive_json() == {
            "type": "error", "detail": "cells deve ter 5 casas [linha, coluna] do tabuleiro."}
        navegador.send_json({"type": "assign_piece", "cells": V, "piece": "Q"})
        assert navegador.receive_json() == {"type": "error", "detail": "Peça inválida."}


def test_comando_desconhecido_continua_recusado(client):
    with client.websocket_connect("/ws/sessions/s1") as navegador:
        navegador.send_json({"type": "board_state"})
        assert navegador.receive_json()["type"] == "error"
