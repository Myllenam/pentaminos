from __future__ import annotations
import json
from collections import defaultdict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import services
from app.constantes import COLUNAS, LETRAS, LINHAS

router = APIRouter(tags=['tempo real'])
_salas: dict[str, set[WebSocket]] = defaultdict(set)

def _erro_atribuicao(msg: dict) -> str | None:
    """Confere o assign_piece do navegador: letra e 5 casas do tabuleiro."""
    casas = msg.get('cells')
    if msg.get('piece') not in LETRAS:
        return 'Peça inválida.'
    if not isinstance(casas, list) or len(casas) != 5 or not all(
            isinstance(c, list) and len(c) == 2 and all(isinstance(x, int) for x in c)
            and 0 <= c[0] < LINHAS and 0 <= c[1] < COLUNAS for c in casas):
        return 'cells deve ter 5 casas [linha, coluna] do tabuleiro.'
    return None

async def _broadcast(sessao: str, payload: dict, origem: WebSocket):
    desconectados=[]
    for cliente in list(_salas[sessao]):
        if cliente is origem: continue
        try: await cliente.send_json(payload)
        except Exception: desconectados.append(cliente)
    for cliente in desconectados: _salas[sessao].discard(cliente)

@router.websocket('/ws/sessions/{sessao_id}')
async def sala_sessao(ws: WebSocket, sessao_id: str):
    await ws.accept(); _salas[sessao_id].add(ws)
    role=ws.query_params.get('role','browser')
    try:
        while True:
            raw=await ws.receive_text()
            if role != 'vision':
                try: controle=json.loads(raw)
                except json.JSONDecodeError: continue
                if isinstance(controle, dict) and controle.get('type') in ('pause','resume','restart','stop'):
                    await _broadcast(sessao_id, {**controle, 'session': sessao_id}, ws)
                elif isinstance(controle, dict) and controle.get('type') == 'assign_piece':
                    erro = _erro_atribuicao(controle)
                    if erro:
                        await ws.send_json({'type':'error','detail':erro})
                    else:
                        await _broadcast(sessao_id, {'type':'assign_piece','session':sessao_id,
                                                     'cells':controle['cells'],'piece':controle['piece']}, ws)
                else:
                    await ws.send_json({'type':'error','detail':'Comando não permitido para o navegador.'})
                continue
            try: msg=json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({'type':'error','detail':'JSON inválido.'}); continue
            if not isinstance(msg,dict) or msg.get('session',sessao_id)!=sessao_id:
                await ws.send_json({'type':'error','detail':'Mensagem inválida ou sessão divergente.'}); continue
            db: Session=SessionLocal()
            try:
                tipo=msg.get('type')
                if tipo in ('piece_placed','piece_removed'):
                    jogada=services.registrar_evento_da_sessao(db,sessao_id,msg)
                    msg['sequence']=jogada.sequencia
                elif tipo=='game_won':
                    sessao=services.finalizar_sessao(db,sessao_id,msg.get('grid'))
                    msg['tempo_total_s']=sessao.tempo_total_s
                    msg['numero_jogadas']=sessao.numero_jogadas
                elif tipo not in ('board_state','camera_status','camera_error','paused','resumed'):
                    await ws.send_json({'type':'error','detail':f'Evento não reconhecido: {tipo}'})
                    continue
            except services.ErroServico as exc:
                await ws.send_json({'type':'error','detail':exc.detail}); continue
            finally: db.close()
            await _broadcast(sessao_id,msg,ws)
    except WebSocketDisconnect:
        pass
    finally:
        _salas[sessao_id].discard(ws)
        if not _salas[sessao_id]: _salas.pop(sessao_id,None)
