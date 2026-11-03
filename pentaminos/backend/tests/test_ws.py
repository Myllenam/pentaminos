V = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]


def test_assign_piece_do_navegador_chega_na_visao(client):
    with client.websocket_connect("/ws/sessions/s1?role=vision") as visao, \
            client.websocket_connect("/ws/sessions/s1") as navegador:
        navegador.send_json({"type": "assign_piece", "cells": V, "piece": "V"})
        assert visao.receive_json() == {"type": "assign_piece", "session": "s1", "cells": V, "piece": "V"}


def test_assign_piece_invalido_recebe_error(client):
    with client.websocket_connect("/ws/sessions/s1") as navegador:
        erro = {"type": "error", "detail": "cells deve ter de 1 a 5 casas [linha, coluna] do tabuleiro."}
        for cells in ([], V + [[3, 3]], [[6, 0]], [[0, 10]], [[True, 0]], "V"):
            navegador.send_json({"type": "assign_piece", "cells": cells, "piece": "V"})
            assert navegador.receive_json() == erro
        navegador.send_json({"type": "assign_piece", "cells": V, "piece": "Q"})
        assert navegador.receive_json() == {"type": "error", "detail": "Peça inválida."}


def test_assign_piece_com_menos_de_5_casas_e_repassado(client):
    with client.websocket_connect("/ws/sessions/s1?role=vision") as visao, \
            client.websocket_connect("/ws/sessions/s1") as navegador:
        navegador.send_json({"type": "assign_piece", "cells": V[:4], "piece": "V"})
        assert visao.receive_json()["cells"] == V[:4]


def test_comando_desconhecido_continua_recusado(client):
    with client.websocket_connect("/ws/sessions/s1") as navegador:
        navegador.send_json({"type": "board_state"})
        assert navegador.receive_json()["type"] == "error"
