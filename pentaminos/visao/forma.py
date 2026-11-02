"""Identificação das peças pela forma."""
from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path

import numpy as np

from config import Config
from gerar_solucoes import _resolver
from pentaminos import LETRAS, normalizar, orientacoes
from visao import INCERTO, VAZIO, Paleta, classificar, pesos_lab
from validador import validar_estado

Celula = tuple[int, int]

VAZIA, OCUPADA, DUVIDA = 0, 1, -1


def distancia(a: np.ndarray, b: np.ndarray, peso_l: float) -> np.ndarray:
    return np.linalg.norm((np.asarray(a) - np.asarray(b)) * pesos_lab(peso_l), axis=-1)


def referencia_vazio(cores_vazio: np.ndarray | None, paleta: Paleta, linhas: int, colunas: int) -> np.ndarray:
    """Cor da casa vazia: a medida no tabuleiro vazio ou o "." da paleta."""
    if cores_vazio is not None:
        return np.asarray(cores_vazio, np.float32)
    return np.broadcast_to(paleta.cores[VAZIO], (linhas, colunas, 3)).astype(np.float32)


def ocupacao(cores: np.ndarray, ref: np.ndarray, cfg: Config) -> np.ndarray:
    d = distancia(cores, ref, cfg.peso_l)
    estado = np.full(d.shape, DUVIDA, dtype=np.int8)
    estado[d < cfg.limiar_ocupada - cfg.margem_ocupada] = VAZIA
    estado[d > cfg.limiar_ocupada + cfg.margem_ocupada] = OCUPADA
    return estado


class _UniaoBusca:
    def __init__(self):
        self.pai: dict[Celula, Celula] = {}

    def achar(self, x: Celula) -> Celula:
        self.pai.setdefault(x, x)
        while self.pai[x] != x:
            self.pai[x] = self.pai[self.pai[x]]
            x = self.pai[x]
        return x

    def unir(self, a: Celula, b: Celula) -> None:
        self.pai[self.achar(a)] = self.achar(b)


def agrupar(cores: np.ndarray, ocupadas: np.ndarray, limiar: float, peso_l: float) -> list[list[Celula]]:
    """Junta vizinhas ocupadas de cor parecida (union-find)."""
    uf = _UniaoBusca()
    linhas, colunas = ocupadas.shape
    for r, c in zip(*np.nonzero(ocupadas)):
        r, c = int(r), int(c)
        uf.achar((r, c))
        for rr, cc in ((r + 1, c), (r, c + 1)):
            if rr < linhas and cc < colunas and ocupadas[rr, cc] \
                    and distancia(cores[r, c], cores[rr, cc], peso_l) < limiar:
                uf.unir((r, c), (rr, cc))
    grupos: dict[Celula, list[Celula]] = {}
    for cel in uf.pai:
        grupos.setdefault(uf.achar(cel), []).append(cel)
    return sorted((sorted(g) for g in grupos.values()), key=lambda g: g[0])


def letras_da_forma(casas: list[Celula], espelhar: bool) -> list[str]:
    forma = normalizar(casas)
    return [l for l in LETRAS if forma in orientacoes(l, espelhar)]


def divisoes(casas: list[Celula], espelhar: bool, limite: int) -> list[list[tuple[str, tuple[Celula, ...]]]]:
    """Coberturas exatas do grupo por pentaminós (Algoritmo X)."""
    dentro = set(casas)
    Y: dict[tuple, list[Celula]] = {}
    for letra in LETRAS:
        for forma in orientacoes(letra, espelhar):
            for r0, c0 in {(r - fr, c - fc) for r, c in casas for fr, fc in forma}:
                pecas = [(r0 + r, c0 + c) for r, c in forma]
                if all(p in dentro for p in pecas):
                    Y[(letra, forma, r0, c0)] = pecas
    X: dict[Celula, set] = {cel: set() for cel in casas}
    for chave, pecas in Y.items():
        for p in pecas:
            X[p].add(chave)
    return [[(letra, tuple(Y[(letra, f, r0, c0)])) for letra, f, r0, c0 in sol]
            for sol in itertools.islice(_resolver(X, Y, []), limite)]


def custo_cor(divisao, cores: np.ndarray, paleta: Paleta, peso_l: float) -> float:
    return float(sum(distancia(np.median([cores[r, c] for r, c in casas], axis=0),
                               paleta.cores[letra], peso_l) for letra, casas in divisao
                     if letra in paleta.cores))


def escolher_divisao(opcoes, cores, paleta: Paleta, peso_l: float, usadas: set[str]):
    """Menos letras repetidas; no empate, menor custo de cor."""
    def chave(divisao):
        letras = [l for l, _ in divisao]
        repetidas = len(letras) - len(set(letras)) + sum(l in usadas for l in letras)
        return repetidas, custo_cor(divisao, cores, paleta, peso_l)
    return min(opcoes, key=chave) if opcoes else None


def classificar_forma(cores: np.ndarray, paleta: Paleta, cfg: Config,
                      cores_vazio: np.ndarray | None = None) -> list[list[str]]:
    """Grade igual à do modo cor, com os nomes pela forma."""
    linhas, colunas = cores.shape[:2]
    estado = ocupacao(cores, referencia_vazio(cores_vazio, paleta, linhas, colunas), cfg)
    grade = [[VAZIO if estado[r, c] == VAZIA else INCERTO for c in range(colunas)] for r in range(linhas)]
    grupos = agrupar(cores, estado == OCUPADA, cfg.limiar_mesma_peca, cfg.peso_l)
    por_cor, _ = classificar(cores, paleta, cfg.limiar_incerto, cfg.peso_l)
    usadas: set[str] = set()
    pendentes = []
    for casas in grupos:
        letras = letras_da_forma(casas, cfg.espelhar) if len(casas) == 5 else []
        if letras:
            for r, c in casas:
                grade[r][c] = letras[0]
            usadas.add(letras[0])
        else:
            pendentes.append(casas)
    for casas in pendentes:
        opcoes = divisoes(casas, cfg.espelhar, cfg.max_divisoes) if len(casas) % 5 == 0 else []
        escolhida = escolher_divisao(opcoes, cores, paleta, cfg.peso_l, usadas)
        if escolhida is None:   # sem divisão: modo por cor
            for r, c in casas:
                grade[r][c] = por_cor[r][c]
            continue
        for letra, pecas in escolhida:
            usadas.add(letra)
            for r, c in pecas:
                grade[r][c] = letra
    return grade


def _pontos(grade, cfg: Config) -> tuple[int, int]:
    estado = validar_estado(grade, cfg.pecas, cfg.espelhar)
    return sum(p.valida for p in estado.pecas.values()), -estado.incertas


def classificar_combinado(cores: np.ndarray, paleta: Paleta, cfg: Config,
                          cores_vazio: np.ndarray | None = None) -> list[list[str]]:
    """Modo cor; se houver peça inválida ou "?", fica com o forma quando ele for melhor."""
    por_cor, _ = classificar(cores, paleta, cfg.limiar_incerto, cfg.peso_l)
    estado = validar_estado(por_cor, cfg.pecas, cfg.espelhar)
    if not estado.invalidas and not estado.incertas:
        return por_cor
    por_forma = classificar_forma(cores, paleta, cfg, cores_vazio)
    return por_forma if _pontos(por_forma, cfg) > _pontos(por_cor, cfg) else por_cor


def carregar_vazio(caminho: str | Path) -> np.ndarray | None:
    caminho = Path(caminho)
    if not caminho.exists():
        return None
    return np.array(json.loads(caminho.read_text(encoding="utf-8")), dtype=np.float32)


def salvar_vazio(cores_vazio: np.ndarray, caminho: str | Path) -> None:
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(np.round(cores_vazio, 3).tolist()), encoding="utf-8")


if __name__ == "__main__":
    import cv2

    from config import carregar_config
    from localizacao import carregar_homografia, retificar
    from visao import cores_das_celulas

    ap = argparse.ArgumentParser(description="Salva a cor de cada casa do tabuleiro vazio.")
    ap.add_argument("foto", help="foto do tabuleiro vazio, no mesmo enquadramento da homografia")
    ap.add_argument("--config")
    a = ap.parse_args()
    cfg = carregar_config(a.config)
    H, _ = carregar_homografia(cfg.arquivo_homografia)
    topo = retificar(cv2.imread(a.foto), H, cfg.largura_px, cfg.altura_px)
    salvar_vazio(cores_das_celulas(topo, cfg.linhas, cfg.colunas, cfg.fracao_central), cfg.arquivo_vazio)
    print(f"Salvo em {cfg.arquivo_vazio}")
