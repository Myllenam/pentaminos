"""Localização manual do tabuleiro.

O usuário clica nos 4 cantos da área de jogo no primeiro quadro; guardamos a
homografia e a reutilizamos enquanto o celular não se mexer (o tripé é fixo).

ORDEM DOS CLIQUES (define a orientação da imagem retificada):
  1 = canto superior esquerdo, 2 = superior direito,
  3 = inferior direito,        4 = inferior esquerdo
da grade 6x10 vista com o lado maior na horizontal.

Uso:
  python localizacao.py --imagem foto.jpg
  python localizacao.py --fonte 0                   
  python localizacao.py --fonte http://IP:4747/video
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

from config import Config, carregar_config

Cantos = list[tuple[float, float]]


def validar_cantos(cantos: Cantos) -> None:
    if len(cantos) != 4:
        raise ValueError("São necessários exatamente 4 cantos.")
    pts = np.array(cantos, dtype=np.float32).reshape(-1, 1, 2)
    if cv2.contourArea(pts) < 100 or not cv2.isContourConvex(pts.astype(np.int32)):
        raise ValueError("Cantos inválidos: devem formar um quadrilátero convexo "
                         "(confira a ordem: sup. esq., sup. dir., inf. dir., inf. esq.).")


def calcular_homografia(cantos: Cantos, largura: int, altura: int) -> np.ndarray:
    validar_cantos(cantos)
    origem = np.array(cantos, dtype=np.float32)
    destino = np.array([[0, 0], [largura, 0], [largura, altura], [0, altura]], dtype=np.float32)
    return cv2.getPerspectiveTransform(origem, destino)


def retificar(frame: np.ndarray, H: np.ndarray, largura: int, altura: int) -> np.ndarray:
    return cv2.warpPerspective(frame, H, (largura, altura))


def salvar_homografia(caminho: str | Path, cantos: Cantos, H: np.ndarray,
                      largura: int, altura: int) -> None:
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps({
        "cantos": [list(map(float, p)) for p in cantos],
        "largura": largura, "altura": altura,
        "H": np.asarray(H).tolist(),
    }, indent=2), encoding="utf-8")


def carregar_homografia(caminho: str | Path) -> tuple[np.ndarray, Cantos]:
    d = json.loads(Path(caminho).read_text(encoding="utf-8"))
    return np.array(d["H"], dtype=np.float64), [tuple(p) for p in d["cantos"]]


def selecionar_cantos(imagem: np.ndarray) -> Cantos | None:
    cliques: Cantos = []
    titulo = "Clique: sup.esq, sup.dir, inf.dir, inf.esq | R refaz | Enter confirma | Q sai"

    def ao_clicar(evento, x, y, *_):
        if evento == cv2.EVENT_LBUTTONDOWN and len(cliques) < 4:
            cliques.append((float(x), float(y)))

    cv2.namedWindow(titulo)
    cv2.setMouseCallback(titulo, ao_clicar)
    try:
        while True:
            vista = imagem.copy()
            for i, (x, y) in enumerate(cliques):
                cv2.circle(vista, (int(x), int(y)), 6, (0, 0, 255), -1)
                cv2.putText(vista, str(i + 1), (int(x) + 8, int(y) - 8),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            if len(cliques) == 4:
                cv2.polylines(vista, [np.array(cliques, np.int32)], True, (0, 255, 0), 2)
            cv2.imshow(titulo, vista)
            tecla = cv2.waitKey(30) & 0xFF
            if tecla in (ord("q"), 27):
                return None
            if tecla == ord("r"):
                cliques.clear()
            if tecla in (13, 10) and len(cliques) == 4:
                return list(cliques)
    finally:
        cv2.destroyAllWindows()


def _ler_quadro(fonte: str) -> np.ndarray:
    captura = cv2.VideoCapture(int(fonte) if fonte.isdigit() else fonte)
    try:
        for _ in range(5):        
            ok, quadro = captura.read()
        if not ok:
            raise RuntimeError(f"Não consegui ler a câmera '{fonte}'.")
        return quadro
    finally:
        captura.release()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--imagem")
    ap.add_argument("--fonte")
    ap.add_argument("--config")
    ap.add_argument("--saida")
    a = ap.parse_args()
    cfg: Config = carregar_config(a.config)
    if a.imagem:
        img = cv2.imread(a.imagem)
        if img is None:
            raise SystemExit(f"Não consegui abrir {a.imagem}")
    else:
        img = _ler_quadro(a.fonte or cfg.fonte_camera)
    cantos = selecionar_cantos(img)
    if cantos is None:
        raise SystemExit("Cancelado.")
    H = calcular_homografia(cantos, cfg.largura_px, cfg.altura_px)
    destino = a.saida or cfg.arquivo_homografia
    salvar_homografia(destino, cantos, H, cfg.largura_px, cfg.altura_px)
    cv2.imshow("Vista de topo (qualquer tecla fecha)",
               retificar(img, H, cfg.largura_px, cfg.altura_px))
    cv2.waitKey(0)
    print(f"Homografia salva em {destino}")
