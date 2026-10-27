from __future__ import annotations

import argparse
import time

import cv2

from config import carregar_config

ap = argparse.ArgumentParser()
ap.add_argument("--fonte")
ap.add_argument("--config")
ap.add_argument("--segundos", type=float, default=10)
ap.add_argument("--mostrar", action="store_true", help="abre uma janela com a imagem (Q fecha)")
ap.add_argument("--salvar", default="amostra_camera.jpg", help="onde salvar o último quadro")
a = ap.parse_args()

cfg = carregar_config(a.config)
fonte = a.fonte or cfg.fonte_camera
captura = cv2.VideoCapture(int(fonte) if fonte.isdigit() else fonte)
if not captura.isOpened():
    raise SystemExit(f"Não consegui abrir '{fonte}'. Confira o app do celular e a rede/USB.")

n, ultimo, t0 = 0, None, time.time()
while time.time() - t0 < a.segundos:
    ok, quadro = captura.read()
    if not ok:
        print("Falha ao ler um quadro; seguindo...")
        continue
    n, ultimo = n + 1, quadro
    if a.mostrar:
        cv2.imshow("camera (Q fecha)", quadro)
        if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
            break
captura.release()
cv2.destroyAllWindows()

dt = time.time() - t0
if ultimo is None:
    raise SystemExit("Nenhum quadro lido.")
h, w = ultimo.shape[:2]
cv2.imwrite(a.salvar, ultimo)
fps = n / dt
print(f"{n} quadros em {dt:.1f}s -> {fps:.1f} fps | resolução {w}x{h} | último quadro em {a.salvar}")
print("OK" if fps >= cfg.fps_alvo * 0.8 else f"ATENÇÃO: abaixo da meta de {cfg.fps_alvo} fps")
