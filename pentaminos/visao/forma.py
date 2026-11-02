"""Identificação das peças pela forma."""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

from config import Config
from gerar_solucoes import _desselecionar, _selecionar
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


class _Estourou(Exception):
    pass


def _resolver_com_prazo(X, Y, parcial, prazo: float):
    """O _resolver de gerar_solucoes, parando no prazo."""
    if time.perf_counter() > prazo:
        raise _Estourou
    if not X:
        yield list(parcial)
        return
    c = min(X, key=lambda col: len(X[col]))
    for chave in list(X[c]):
        parcial.append(chave)
        removidas = _selecionar(X, Y, chave)
        yield from _resolver_com_prazo(X, Y, parcial, prazo)
        _desselecionar(X, Y, chave, removidas)
        parcial.pop()


def divisoes(casas: list[Celula], espelhar: bool, limite: int,
             prazo: float = float("inf")) -> list[list[tuple[str, tuple[Celula, ...]]]]:
    """Coberturas exatas do grupo por pentaminós (Algoritmo X)."""
    if len(casas) % 5:
        return []
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
    achadas = []
    try:
        for sol in _resolver_com_prazo(X, Y, [], prazo):
            achadas.append([(letra, tuple(Y[(letra, f, r0, c0)])) for letra, f, r0, c0 in sol])
            if len(achadas) >= limite:
                break
    except _Estourou:
        pass
    return achadas


def custo_cor(divisao, cores: np.ndarray, paleta: Paleta, peso_l: float) -> float:
    return float(sum(distancia(np.median([cores[r, c] for r, c in casas], axis=0),
                               paleta.cores[letra], peso_l) for letra, casas in divisao
                     if letra in paleta.cores))


def _repetidas(divisao, usadas) -> int:
    letras = [l for l, _ in divisao]
    return len(letras) - len(set(letras)) + sum(l in usadas for l in letras)


def escolher_divisao(opcoes, cores, paleta: Paleta, peso_l: float, usadas):
    """Menos letras repetidas; no empate, menor custo de cor."""
    chave = lambda d: (_repetidas(d, usadas), custo_cor(d, cores, paleta, peso_l))
    return min(opcoes, key=chave) if opcoes else None


def _componentes(casas: set[Celula]) -> list[list[Celula]]:
    restantes, saida = set(casas), []
    while restantes:
        pilha, comp = [restantes.pop()], []
        while pilha:
            r, c = pilha.pop()
            comp.append((r, c))
            for v in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if v in restantes:
                    restantes.remove(v)
                    pilha.append(v)
        saida.append(sorted(comp))
    return sorted(saida)


def _vizinhas(casas) -> set[Celula]:
    dentro = set(casas)
    return {v for r, c in casas for v in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1))} - dentro


class _Leitura:
    """Estado da classificação por forma de um quadro."""

    def __init__(self, cores, paleta, cfg, cores_vazio):
        self.cores, self.paleta, self.cfg = cores, paleta, cfg
        linhas, colunas = cores.shape[:2]
        self.ref = referencia_vazio(cores_vazio, paleta, linhas, colunas)
        self.d_vazio = distancia(cores, self.ref, cfg.peso_l)
        self.estado = ocupacao(cores, self.ref, cfg)
        self.prazo = time.perf_counter() + cfg.tempo_max_forma_ms / 1000
        self.pecas: dict[str, tuple[Celula, ...]] = {}
        self.extras: list[tuple[str, tuple[Celula, ...]]] = []   # letras repetidas

    def _quase_ocupada(self, r: int, c: int) -> bool:
        croma = np.hypot(*self.cores[r, c, 1:]) - np.hypot(*self.ref[r, c, 1:])
        return self.estado[r, c] == VAZIA and (self.d_vazio[r, c] > self.cfg.limiar_ocupada_fraca
                                               or croma > self.cfg.limiar_croma_fraca)

    def _limpa(self, casas, usadas):
        opcoes = [d for d in divisoes(casas, self.cfg.espelhar, self.cfg.max_divisoes, self.prazo)
                  if _repetidas(d, usadas) == 0]
        return escolher_divisao(opcoes, self.cores, self.paleta, self.cfg.peso_l, usadas)

    def resolver(self, comp: list[Celula]) -> bool:
        usadas = set(self.pecas)
        div = self._limpa(comp, usadas)
        if div is None and len(comp) % 5 == 4:   # falta uma casa: reflexo, sombra
            linhas, colunas = self.estado.shape
            fracas = sorted((v for v in _vizinhas(comp)
                             if 0 <= v[0] < linhas and 0 <= v[1] < colunas and self._quase_ocupada(*v)),
                            key=lambda v: -self.d_vazio[v])
            for v in fracas:
                div = self._limpa(comp + [v], usadas)
                if div:
                    break
        if div is None:   # solta as peças aceitas que encostam no componente
            vizinhas = _vizinhas(comp)
            for letra in [l for l, casas in self.pecas.items() if vizinhas & set(casas)]:
                div = self._limpa(sorted(set(comp) | set(self.pecas[letra])), usadas - {letra})
                if div:
                    del self.pecas[letra]
                    break
        if div is None:
            return False
        for letra, casas in div:
            self.pecas[letra] = casas
        return True


def classificar_forma(cores: np.ndarray, paleta: Paleta, cfg: Config,
                      cores_vazio: np.ndarray | None = None) -> list[list[str]]:
    """Grade igual à do modo cor, com os nomes pela forma."""
    leitura = _Leitura(cores, paleta, cfg, cores_vazio)
    linhas, colunas = cores.shape[:2]
    sobras: set[Celula] = {(int(r), int(c)) for r, c in zip(*np.nonzero(leitura.estado == DUVIDA))}
    for casas in agrupar(cores, leitura.estado == OCUPADA, cfg.limiar_mesma_peca, cfg.peso_l):
        livres = [l for l in (letras_da_forma(casas, cfg.espelhar) if len(casas) == 5 else [])
                  if l not in leitura.pecas]
        if livres:
            leitura.pecas[livres[0]] = tuple(casas)
        else:
            sobras |= set(casas)
    por_cor, _ = classificar(cores, paleta, cfg.limiar_incerto, cfg.peso_l)
    sem_nome: list[Celula] = []
    for comp in _componentes(sobras):
        if not leitura.resolver(comp):
            div = divisoes(comp, cfg.espelhar, cfg.max_divisoes, leitura.prazo)
            if div:   # só com letra repetida: o validador acusa
                leitura.extras += escolher_divisao(div, cores, paleta, cfg.peso_l, set(leitura.pecas))
            else:
                sem_nome += comp
    grade = [[VAZIO if leitura.estado[r, c] == VAZIA else INCERTO for c in range(colunas)]
             for r in range(linhas)]
    for letra, casas in list(leitura.pecas.items()) + leitura.extras:
        for r, c in casas:
            grade[r][c] = letra
    for r, c in sem_nome:   # sem divisão: modo por cor
        grade[r][c] = por_cor[r][c]
    return grade


def classificar_combinado(cores: np.ndarray, paleta: Paleta, cfg: Config,
                          cores_vazio: np.ndarray | None = None) -> list[list[str]]:
    """Escolhe por peça: forma válida; senão, cor."""
    por_forma = classificar_forma(cores, paleta, cfg, cores_vazio)
    por_cor, _ = classificar(cores, paleta, cfg.limiar_incerto, cfg.peso_l)
    ef = validar_estado(por_forma, cfg.pecas, cfg.espelhar)
    ec = validar_estado(por_cor, cfg.pecas, cfg.espelhar)
    validas = {l for l, p in ef.pecas.items() if p.valida}
    presas = {c for l in validas for c in ef.pecas[l].casas}
    grade = [linha[:] for linha in por_forma]
    for letra, peca in ec.pecas.items():
        if peca.valida and letra not in validas and not presas & set(peca.casas):
            for r, c in peca.casas:
                grade[r][c] = letra
    return grade


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
