"""Loop da visão: câmera ou fonte sintética, ~10 quadros/s (exemplos no README)."""
from __future__ import annotations
import argparse, asyncio, json, logging, time
from pathlib import Path
import cv2
import numpy as np
import websockets
from config import Config, carregar_config
from localizacao import carregar_homografia
from pipeline import Pipeline
from sintetico import CORES_APP, FUNDO_MDF, CANTOS_PADRAO, projetar, renderizar, com_ruido, grade_vazia, colocar_peca
from gerar_solucoes import solucoes
from localizacao import calcular_homografia
from visao import Paleta
from forma import carregar_vazio

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
LOG=logging.getLogger('pentaminos.vision')

class FonteSintetica:
    """Produz uma partida inteira, repetindo cada estado para estabilização."""
    def __init__(self, cfg):
        self.cfg=cfg; self.rng=np.random.default_rng(21); self.frames=[]
        sol=next(solucoes(espelhar=True)); grade=grade_vazia()
        self.frames.extend([self._frame(grade)]*5)
        for letra in sorted({celula for linha in sol for celula in linha if celula != '.'}):
            for r in range(cfg.linhas):
                for c in range(cfg.colunas):
                    if sol[r][c] == letra: grade[r][c]=letra
            # Cada estado contém uma peça inteira, como uma jogada real concluída.
            self.frames.extend([self._frame(grade)]*5)
        self.i=0
    def _frame(self, grade):
        return com_ruido(projetar(renderizar(grade)), sigma=1.5, rng=self.rng)
    def read(self):
        frame=self.frames[self.i % len(self.frames)]; self.i+=1
        return True, frame.copy()
    def release(self): pass

async def executar(args):
    cfg=carregar_config(args.config)
    if args.fonte == 'sintetica':
        captura=FonteSintetica(cfg)
        H=calcular_homografia(CANTOS_PADRAO,cfg.largura_px,cfg.altura_px)
        paleta=Paleta.de_hex(CORES_APP,FUNDO_MDF)
    else:
        captura=cv2.VideoCapture(int(args.fonte) if args.fonte.isdigit() else args.fonte)
        if not captura.isOpened(): LOG.warning('Fonte %s indisponível; o status perdida será enviado ao navegador', args.fonte)
        hpath=Path(args.homografia or cfg.arquivo_homografia)
        ppath=Path(args.paleta or cfg.arquivo_paleta)
        if not hpath.exists() or not ppath.exists():
            raise FileNotFoundError('Calibre antes a câmera: faltam homografia.json ou paleta.json.')
        H,_=carregar_homografia(hpath); paleta=Paleta.carregar(ppath)
    vazio=None if args.fonte == 'sintetica' else carregar_vazio(cfg.arquivo_vazio)
    pipe=Pipeline(cfg,H,paleta,sessao=args.sessao,cores_vazio=vazio)
    ws_url=args.ws_url.rstrip('/')+f'/ws/sessions/{args.sessao}?role=vision'
    intervalo=1/max(1,args.fps or cfg.fps_alvo); anterior_status=None; jogadas=0; inicio=time.monotonic(); pausado=False
    try:
        async with websockets.connect(ws_url, ping_interval=20) as ws:
            async def enviar(msg): await ws.send(json.dumps(msg,ensure_ascii=False))
            grade_atual=None
            status_inicial = 'sintetica' if args.fonte == 'sintetica' else ('conectada' if captura.isOpened() else 'perdida')
            await enviar({'type':'camera_status','status':status_inicial,'session':args.sessao,'ts':int(time.time())})
            anterior_status = 'perdida' if status_inicial == 'perdida' else None
            while True:
                tick=time.monotonic()
                try:
                    controle=json.loads(await asyncio.wait_for(ws.recv(), timeout=0.001))
                    if controle.get('type') == 'stop':
                        LOG.info('Loop encerrado pelo navegador')
                        break
                    if controle.get('type') == 'pause': pausado=True; LOG.info('Loop pausado pelo navegador')
                    elif controle.get('type') == 'resume': pausado=False; LOG.info('Loop retomado pelo navegador')
                    elif controle.get('type') == 'restart':
                        LOG.info('Reinício solicitado; encerre e inicie uma nova sessão para reiniciar o pipeline')
                except asyncio.TimeoutError: pass
                if pausado:
                    await asyncio.sleep(0.1); continue
                ok,frame=captura.read()
                if not ok:
                    if anterior_status!='perdida':
                        await enviar({'type':'camera_status','status':'perdida','session':args.sessao,'ts':int(time.time())})
                        anterior_status='perdida'
                    await asyncio.sleep(0.5); continue
                if anterior_status == 'perdida':
                    await enviar({'type':'camera_status','status':'conectada','session':args.sessao,'ts':int(time.time())})
                if anterior_status!='tabuleiro_detectado':
                    await enviar({'type':'camera_status','status':'tabuleiro_detectado','session':args.sessao,'ts':int(time.time())}); anterior_status='tabuleiro_detectado'
                resultado=pipe.processar(frame)
                if resultado.descartado:
                    LOG.info('Quadro descartado: %s',resultado.motivo)
                for msg in resultado.mensagens:
                    LOG.info('Evento: %s',msg.get('type'))
                    if msg.get('type') == 'board_state': grade_atual=msg.get('grid')
                    await enviar(msg)
                    if msg.get('type') in ('piece_placed','piece_removed') and msg.get('type')=='piece_placed': jogadas+=1
                if resultado.estado and resultado.estado.vitoria:
                    await enviar({'type':'game_won','session':args.sessao,'tempo_total_s':int(time.monotonic()-inicio),'numero_jogadas':jogadas,'grid':grade_atual,'ts':int(time.time())})
                    break
                await asyncio.sleep(max(0,intervalo-(time.monotonic()-tick)))
    finally: captura.release()

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--fonte',default='0',help='índice/url da câmera ou sintetica')
    ap.add_argument('--sessao',required=True)
    ap.add_argument('--ws-url',default='ws://localhost:8000')
    ap.add_argument('--fps',type=float,default=10)
    ap.add_argument('--config'); ap.add_argument('--homografia'); ap.add_argument('--paleta')
    asyncio.run(executar(ap.parse_args()))
if __name__=='__main__': main()
