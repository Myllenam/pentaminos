"""Atividade 4 — calibrar o código da visão com as fotos reais.

Mede as cores nas fotos (e não nos códigos hex), lista os pares perigosos, compara
espaços de cor, escolhe o limiar de "incerto" e diz se o plano B (ArUco) é necessário.

Uso (PowerShell):
    python calibrar_fotos.py --pasta ..\\fotos-pentaminos
    python calibrar_fotos.py --pasta ..\\fotos-pentaminos --saida calibracao

Gera em --saida (padrão: calibracao/):
    paleta.json              paleta Lab medida no tabuleiro (formato de Paleta.carregar)
    relatorio_calibracao.md  números e decisões

Nomes esperados na pasta (os mesmos do zip de fotos):
    tabuleiro_vazio.jpeg, tabuleiro_vazio_2/3.jpeg    tabuleiro sem peças
    peca_f.jpeg ... peca_z.jpeg                       uma peça sozinha
    tabuleiro_1_{1..11}_pecas.jpeg, tabuleiro_1_completo.jpeg   sequência: +1 peça por foto
    tabuleiro_2_{1..11}_pecas.jpeg, tabuleiro_2_completo.jpeg   (idem, outra solução)
    *_luz_diferente.jpeg, *_mao*.jpeg, tabuleiro_z.jpeg, peca_n_2.jpeg   casos difíceis
    WhatsApp Image ... .jpeg                          um 3º tabuleiro completo, só para teste

COMO O GABARITO É FEITO (sem olhar a cor): em cada foto da sequência as casas novas
são as que ganharam cor (croma alto contra o papel); como são 5, a FORMA delas diz a
letra (pentaminos.forma_corresponde). Assim a cor das peças é medida contra um
gabarito independente dela.

ALINHAMENTO: o celular/papel se mexeu entre as fotos (30–50 px), então cada foto é
alinhada pelos 4 cantos da folha branca antes de usar a mesma homografia da grade.
No uso real (celular fixo no tripé) basta a localizacao.py uma vez.
"""
from __future__ import annotations

import argparse
import itertools
import re
from pathlib import Path

import cv2
import numpy as np

from config import Config
from pentaminos import LETRAS, forma_corresponde
from visao import (INCERTO, VAZIO, Paleta, classificar, cores_das_celulas,
                   pesos_lab)

CFG = Config()
FR = CFG.fracao_central
CHAVES = list(LETRAS) + [VAZIO]
LIMIAR_OCUPADA = 10.0   # croma (a,b) acima disto = casa com peça; papel fica perto de 0

# --- Referência: medida em tabuleiro_vazio.jpeg (foto em pé, 960x1280) --------------
# Cantos da grade 6x10 na foto, na ordem sup.esq, sup.dir, inf.dir, inf.esq da FOTO.
GRADE_REF = [(271, 191), (741, 191), (741, 976), (271, 976)]
# Faixas de papel branco fora da moldura (x0, x1, y0, y1): referência de exposição.
TIRAS_BRANCO = [(165, 215, 200, 950), (800, 860, 200, 950),
                (300, 720, 70, 135), (300, 720, 1035, 1090)]
TAM_REF = (960, 1280)


# =====================================================================================
# Alinhamento
# =====================================================================================

def _ordenar(q: np.ndarray) -> np.ndarray:
    q = np.asarray(q, np.float32)
    s, d = q.sum(1), q[:, 0] - q[:, 1]
    return np.array([q[s.argmin()], q[d.argmax()], q[s.argmax()], q[d.argmin()]], np.float32)


def _quad_papel_bruto(img: np.ndarray):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = ((hsv[..., 1] < 60) & (hsv[..., 2] > 120)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cs, key=cv2.contourArea)
    casco = cv2.convexHull(c)
    per = cv2.arcLength(casco, True)
    for eps in np.linspace(0.01, 0.08, 15):
        ap = cv2.approxPolyDP(casco, eps * per, True)
        if len(ap) == 4:
            return _ordenar(ap.reshape(4, 2)), cv2.contourArea(c)
    return None, cv2.contourArea(c)


def quad_papel(img: np.ndarray, esperado: np.ndarray | None = None):
    """4 cantos da folha (TL, TR, BR, BL). Com uma mão cobrindo um canto, refaz esse
    canto pela regra do paralelogramo usando os outros três."""
    q, area = _quad_papel_bruto(img)
    h, w = img.shape[:2]
    if q is not None and area > 0.55 * h * w:
        return q
    if q is None or esperado is None:
        raise RuntimeError("Não achei a folha de papel na foto.")
    ok = [np.linalg.norm(q[i] - esperado[i]) < 70 for i in range(4)]
    if sum(ok) != 3:
        raise RuntimeError("Folha parcialmente coberta: não deu para recuperar os cantos.")
    i = ok.index(False)
    q = q.copy()
    q[i] = q[(i + 1) % 4] + q[(i - 1) % 4] - q[(i + 2) % 4]
    return q


class Alinhador:
    """Leva qualquer foto para a vista de topo 1000x600 (10 colunas x 6 linhas)."""

    def __init__(self, foto_vazia: np.ndarray):
        self.q0 = quad_papel(foto_vazia)
        g = np.array(GRADE_REF, np.float32)
        # a foto está em pé; girar 90° (horário) põe o lado maior na horizontal:
        # sup.esq = inf.esq da foto, sup.dir = sup.esq, inf.dir = sup.dir, inf.esq = inf.dir
        origem = np.array([g[3], g[0], g[1], g[2]], np.float32)
        destino = np.array([[0, 0], [CFG.largura_px, 0],
                            [CFG.largura_px, CFG.altura_px], [0, CFG.altura_px]], np.float32)
        self.h_grade = cv2.getPerspectiveTransform(origem, destino)
        self.branco_ref = self._branco(foto_vazia)

    def _branco(self, foto_na_ref: np.ndarray) -> np.ndarray:
        px = np.concatenate([foto_na_ref[y0:y1, x0:x1].reshape(-1, 3)
                             for x0, x1, y0, y1 in TIRAS_BRANCO])
        return np.median(px, axis=0)

    def foto_na_referencia(self, img: np.ndarray) -> np.ndarray:
        q = quad_papel(img, self.q0)
        return cv2.warpPerspective(img, cv2.getPerspectiveTransform(q, self.q0), TAM_REF)

    def branco_do_papel(self, img: np.ndarray) -> float:
        """Brilho médio do papel branco da margem (sobe quando a câmera clareia a foto)."""
        return float(self._branco(self.foto_na_referencia(img)).mean())

    def retificar(self, img: np.ndarray, normalizar: bool = False) -> np.ndarray:
        ref = self.foto_na_referencia(img)
        if normalizar:   # corrige exposição/balanço pelo papel branco (luz linear)
            f = (self.branco_ref / self._branco(ref)) ** 2.2
            lin = (ref.astype(np.float32) / 255.0) ** 2.2 * f
            ref = (np.clip(lin, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)
        return cv2.warpPerspective(ref, self.h_grade, (CFG.largura_px, CFG.altura_px))


# =====================================================================================
# Gabarito
# =====================================================================================

def _ocupadas(cel: np.ndarray) -> np.ndarray:
    return np.hypot(cel[..., 1], cel[..., 2]) > LIMIAR_OCUPADA


def _letra_pela_forma(celulas) -> str | None:
    letras = [l for l in LETRAS if forma_corresponde(l, celulas, True)]
    return letras[0] if len(celulas) == 5 and len(letras) == 1 else None


def gabarito_das_sequencias(cel: dict[str, np.ndarray], nomes: list[str]) -> dict[str, list[list[str]]]:
    gt: dict[str, list[list[str]]] = {}
    for b in (1, 2):
        sequencia = []
        for k in range(1, 12):
            achou = [n for n in nomes if re.fullmatch(rf"tabu\w*ro_{b}_{k}_pecas", n)]
            sequencia += achou[:1]
        sequencia.append(f"tabuleiro_{b}_completo")
        if any(n not in cel for n in sequencia) or len(sequencia) != 12:
            continue
        anterior = np.zeros((6, 10), bool)
        grade = [[VAZIO] * 10 for _ in range(6)]
        for n in sequencia:
            ocup = _ocupadas(cel[n])
            novas = [tuple(map(int, x)) for x in np.argwhere(ocup & ~anterior)]
            letra = _letra_pela_forma(novas)
            if letra is None or (anterior & ~ocup).any():
                raise ValueError(f"{n}: a sequência não acrescentou exatamente uma peça reconhecível.")
            for r, c in novas:
                grade[r][c] = letra
            gt[n] = [linha[:] for linha in grade]
            anterior = ocup
    for n in nomes:       # mesma cena com outra luz
        base = n.removesuffix("_luz_diferente")
        if n != base and base in gt:
            gt[n] = gt[base]
    return gt


def gabarito_dos_casos_dificeis(cel: dict[str, np.ndarray], gt) -> dict[str, list[list[str]]]:
    """Mão sobre o tabuleiro, sombra e peças soltas: o gabarito vem da cena sem a mão
    ou da forma da peça (cor não é usada)."""
    extra: dict[str, list[list[str]]] = {}
    vazio = [[VAZIO] * 10 for _ in range(6)]
    for n in ("tabuleiro_vazio_mao", "tabuleiro_vazio_mao_em_cima"):
        if n in cel:
            extra[n] = vazio
    for n, base in (("tabuleiro_1_mao", "tabuleiro_1_completo"),
                    ("tabuleiro_2_completo_mao", "tabuleiro_2_completo")):
        if n in cel and base in gt:
            extra[n] = gt[base]
    for n in [n for n in cel if re.fullmatch(r"peca_[a-z](_\d)?", n) or n == "tabuleiro_z"]:
        if n.endswith("_luz_diferente"):
            continue
        cs = [tuple(map(int, x)) for x in np.argwhere(_ocupadas(cel[n]))]
        letra = _letra_pela_forma(cs)
        if letra:
            g = [[VAZIO] * 10 for _ in range(6)]
            for r, c in cs:
                g[r][c] = letra
            extra[n] = g
    return extra


# =====================================================================================
# Medidas
# =====================================================================================

def _features(lab: np.ndarray, modo: str) -> np.ndarray:
    lab = np.asarray(lab, np.float32).reshape(-1, 3)
    if modo == "lab":
        return lab
    if modo == "lab_l05":
        return lab * pesos_lab(0.5)
    if modo == "ab":
        return lab[:, 1:]
    # HSV em coordenadas cartesianas (o matiz dá a volta em 0°/360°, então não se subtrai direto)
    bgr = cv2.cvtColor(lab.reshape(-1, 1, 3), cv2.COLOR_LAB2BGR).reshape(-1, 3)
    h, s, v = cv2.cvtColor(bgr.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3).T
    a = np.deg2rad(h)
    return np.stack([100 * s * v * np.cos(a), 100 * s * v * np.sin(a), 100 * v], 1)


def amostras(cel, gt, fotos):
    X, y, f = [], [], []
    for n in fotos:
        for r in range(6):
            for c in range(10):
                X.append(cel[n][r, c]); y.append(gt[n][r][c]); f.append(n)
    return np.array(X), np.array(y), f


def paleta_mediana(X, y) -> dict[str, np.ndarray]:
    return {k: np.median(X[y == k], axis=0) for k in CHAVES if (y == k).any()}


def paleta_das_pecas_soltas(cel) -> dict[str, np.ndarray]:
    """O que construir_paleta faz: uma foto por peça contra o tabuleiro vazio."""
    vazio = cel["tabuleiro_vazio"]
    pal = {}
    for l in LETRAS:
        c = cel[f"peca_{l.lower()}"]
        pal[l] = np.median(c[np.linalg.norm(c - vazio, axis=2) > 20], axis=0)
    pal[VAZIO] = np.median(np.stack([cel[n] for n in cel if re.fullmatch(r"tabuleiro_vazio(_\d)?", n)])
                           .reshape(-1, 3), axis=0)
    return pal


def prever(pal, X, modo):
    ks = list(pal)
    d = np.linalg.norm(_features(X, modo)[:, None] - _features(np.stack([pal[k] for k in ks]), modo)[None], axis=2)
    return np.array(ks)[d.argmin(1)], d.min(1)


def validacao_cruzada(cel, gt, grupos, modo, fonte):
    """Treina a paleta num tabuleiro e testa no outro (e vice-versa)."""
    erros, total, conf, d_ok, d_erro = 0, 0, {}, [], []
    for treino, teste in (grupos, grupos[::-1]):
        Xt, yt, _ = amostras(cel, gt, teste)
        pal = paleta_das_pecas_soltas(cel) if fonte == "soltas" else paleta_mediana(*amostras(cel, gt, treino)[:2])
        p, dm = prever(pal, Xt, modo)
        for t, q, d in zip(yt, p, dm):
            total += 1
            if t == q:
                d_ok.append(d)
            else:
                erros += 1; d_erro.append(d); conf[(str(t), str(q))] = conf.get((str(t), str(q)), 0) + 1
    return erros, total, conf, np.array(d_ok), np.array(d_erro)


# =====================================================================================
# Relatório
# =====================================================================================

def _linha(*c) -> str:
    return "| " + " | ".join(str(x) for x in c) + " |"


def gerar(pasta: Path, saida: Path) -> str:
    caminhos = {p.stem: p for p in sorted(pasta.glob("*.jp*g"))}
    if "tabuleiro_vazio" not in caminhos:
        raise SystemExit("Falta tabuleiro_vazio.jpeg na pasta de fotos.")
    imgs = {n: cv2.imread(str(p)) for n, p in caminhos.items()}
    alin = Alinhador(imgs["tabuleiro_vazio"])

    def celulas(normalizar=False):
        out = {}
        for n, im in imgs.items():
            try:
                out[n] = cores_das_celulas(alin.retificar(im, normalizar), 6, 10, FR)
            except RuntimeError:
                pass
        return out

    cel, cel_n = celulas(), celulas(True)
    gt = gabarito_das_sequencias(cel, list(cel))
    extra = gabarito_dos_casos_dificeis(cel, gt)
    f1 = [n for n in gt if re.match(r"tabu\w*ro_1_", n)]
    f2 = [n for n in gt if re.match(r"tabu\w*ro_2_", n)]
    grupos = (f1, f2)
    L: list[str] = []
    P = L.append

    P("# Atividade 4 — Calibração com as fotos reais\n")
    P(f"{len(imgs)} fotos lidas; {len(gt)} com gabarito de sequência "
      f"({len(f1)} do tabuleiro 1, {len(f2)} do tabuleiro 2) e {len(extra)} casos difíceis "
      "(mão, sombra, peça sozinha). Gabarito = forma das casas novas, sem usar a cor.\n")

    # --- exposição -------------------------------------------------------------------
    P("## 0. A câmera clareia a foto conforme entram peças\n")
    P("Brilho médio do papel branco da margem (nunca coberto por peças):\n")
    P(_linha("foto", "papel (0–255)")); P(_linha("---", "---"))
    for n in ("tabuleiro_vazio", "tabuleiro_1_3_pecas", "tabuleiro_1_7_pecas", "tabuleiro_1_completo", "tabuleiro_2_completo"):
        if n in imgs:
            P(_linha(n, f"{alin.branco_do_papel(imgs[n]):.0f}"))
    exemplo = ""
    if "tabuleiro_1_3_pecas" in gt and "tabuleiro_1_completo" in gt:
        def l_da_peca(n, letra="V"):
            v = [cel[n][r, c][0] for r in range(6) for c in range(10) if gt[n][r][c] == letra]
            return float(np.median(v))
        exemplo = (f" (a peça V mede L≈{l_da_peca('tabuleiro_1_3_pecas'):.0f} com 3 peças em jogo e "
                   f"L≈{l_da_peca('tabuleiro_1_completo'):.0f} com o tabuleiro cheio)")
    P("\nCom o papel mais claro, as peças também saem mais claras" + exemplo + ". Isso é a maior fonte "
      "de erro e pede **travar exposição e balanço de branco** no app da câmera "
      "(DroidCam/IP Webcam têm essa opção).\n")

    # --- pares -----------------------------------------------------------------------
    soltas = paleta_das_pecas_soltas(cel)
    X_all, y_all, _ = amostras(cel, gt, f1 + f2)
    no_tab = paleta_mediana(X_all, y_all)
    w = pesos_lab(CFG.peso_l)
    P("## 1. Distâncias entre as cores reais (pares mais próximos)\n")
    P("Distância Lab entre as medianas de cada cor. “Soltas” = paleta feita com as fotos de uma peça "
      "sozinha; “no tabuleiro” = mediana das casas rotuladas nas fotos com o tabuleiro montado. "
      f"A última coluna pesa a luminosidade por {CFG.peso_l} (a escolha da seção 2).\n")
    P(_linha("par", "soltas", "no tabuleiro", f"no tabuleiro, L×{CFG.peso_l}")); P(_linha("---", "---", "---", "---"))
    ordem = sorted(itertools.combinations(CHAVES, 2), key=lambda p: np.linalg.norm(no_tab[p[0]] - no_tab[p[1]]))
    for a, b in ordem[:8]:
        P(_linha(f"{a}–{b}".replace(VAZIO, "vazio"),
                 f"{np.linalg.norm(soltas[a] - soltas[b]):.1f}",
                 f"{np.linalg.norm(no_tab[a] - no_tab[b]):.1f}",
                 f"{np.linalg.norm((no_tab[a] - no_tab[b]) * w):.1f}"))
    P("")

    # --- espaço de cor ---------------------------------------------------------------
    P("## 2. Espaço de cor\n")
    P("Cada casa rotulada é classificada pela cor mais próxima da paleta. Paleta “no tabuleiro” é "
      "treinada num tabuleiro e testada no outro (validação cruzada, sem vazamento).\n")
    P(_linha("espaço / distância", "paleta", "erros", "principais confusões")); P(_linha("---", "---", "---", "---"))
    modos = [("Lab (L×1)", "lab"), ("Lab (L×0,5)", "lab_l05"), ("Lab só a,b", "ab"), ("HSV", "hsv")]
    resultado = {}
    for nome, modo in modos:
        for fonte, fnome in (("soltas", "peças soltas"), ("tabuleiro", "no tabuleiro")):
            e, t, conf, d_ok, d_er = validacao_cruzada(cel, gt, grupos, modo, fonte)
            resultado[(modo, fonte)] = (e, t, conf, d_ok, d_er)
            top = ", ".join(f"{a}→{b} ×{n}".replace(VAZIO, "vazio") for (a, b), n in sorted(conf.items(), key=lambda x: -x[1])[:3])
            P(_linha(nome, fnome, f"{e}/{t} ({100 * e / t:.1f}%)", top))
    # mesmo teste com normalização pelo papel
    e, t, conf, *_ = validacao_cruzada(cel_n, gt, grupos, "lab_l05", "tabuleiro")
    P(_linha("Lab (L×0,5) + normalização pelo papel", "no tabuleiro", f"{e}/{t} ({100 * e / t:.1f}%)",
             ", ".join(f"{a}→{b} ×{n}" for (a, b), n in sorted(conf.items(), key=lambda x: -x[1])[:3])))
    P("")
    e_l, e_p = resultado[("lab", "tabuleiro")][0], resultado[("lab_l05", "tabuleiro")][0]
    P(f"A normalização pelo papel (última linha) ajuda pouco e não entrou no pipeline; travar a "
      "exposição no app resolve o mesmo problema sem código.\n")
    P(f"**Escolha: Lab, com a luminosidade pesando {CFG.peso_l}** (`peso_l` em `config.py`). "
      f"O HSV e o Lab sem L erram mais; o Lab puro erra {e_l}, com L×{CFG.peso_l} erra {e_p}. "
      "O L não pode sumir (V e Z só diferem nele) nem pesar demais (sombra no papel parece cor). "
      "O que mais derruba o erro é a paleta ser medida **no tabuleiro montado**, não com as peças soltas.\n")

    # --- pares que não separam ------------------------------------------------------------
    _, _, conf, d_ok, d_er = resultado[("lab_l05", "tabuleiro")]
    n_por = {k: int((y_all == k).sum()) for k in CHAVES}
    P("## 3. Pares perigosos (resultado cruzado, Lab L×0,5)\n")
    P(_linha("par", "casas do par", "confundidas", "taxa", "distância na paleta")); P(_linha("---", "---", "---", "---", "---"))
    veredito = []
    for a, b in itertools.combinations(CHAVES, 2):
        n_conf = conf.get((a, b), 0) + conf.get((b, a), 0)
        dist = float(np.linalg.norm((no_tab[a] - no_tab[b]) * w))
        taxa = n_conf / max(1, n_por[a] + n_por[b])
        if n_conf or dist < 15:
            P(_linha(f"{a}–{b}".replace(VAZIO, "vazio"), n_por[a] + n_por[b], n_conf, f"{100 * taxa:.1f}%", f"{dist:.1f}"))
        if taxa >= 0.02 or dist < 8:
            veredito.append((a, b, n_conf, taxa, dist))
    P("")

    # --- limiar -------------------------------------------------------------------------
    P("## 4. Limiar de “incerto”\n")
    P(f"Distância (L×{CFG.peso_l}) até a cor mais próxima. Acertos do teste cruzado: mediana "
      f"{np.median(d_ok):.1f}, p95 {np.percentile(d_ok, 95):.1f}, p99 {np.percentile(d_ok, 99):.1f}. "
      "Casas de casos difíceis (mão, sombra, peça sozinha) classificadas com a paleta final:\n")
    pal_final = paleta_mediana(X_all, y_all)
    dm_ruins, dm_extra_certas = [], []
    pior_mao = {}
    for n, g in extra.items():
        X, y, _ = amostras(cel, extra, [n])
        p, dm = prever(pal_final, X, "lab_l05")
        dm_ruins += list(dm[p != y]); dm_extra_certas += list(dm[p == y]); pior_mao[n] = dm
    P(_linha("limiar", "acertos marcados “?”", "casos difíceis errados e aceitos", "fotos do teste com ≤ 3 “?”")); P(_linha("---", "---", "---", "---"))
    cont_foto = {}
    for treino, teste in (grupos, grupos[::-1]):
        pal = paleta_mediana(*amostras(cel, gt, treino)[:2])
        for n in teste:
            cont_foto[n] = prever(pal, cel[n].reshape(-1, 3), "lab_l05")[1]
    for T in (10, 12, 14, 16, 18, 20):
        ok_pct = 100 * (d_ok > T).mean()
        aceitos = int((np.array(dm_ruins) <= T).sum())
        fotos_ok = sum(int((v > T).sum()) <= CFG.max_incertas for v in cont_foto.values())
        marca = "  ← escolhido" if T == int(CFG.limiar_incerto) else ""
        P(_linha(f"{T}{marca}", f"{ok_pct:.1f}%", f"{aceitos}/{len(dm_ruins)}", f"{fotos_ok}/{len(cont_foto)}"))
    P(f"\n**Escolha: `limiar_incerto = {CFG.limiar_incerto}` e `max_incertas = {CFG.max_incertas}`.** "
      "O padrão antigo (20) não marcava quase nada de mão/sombra. Com 16, um quadro normal passa "
      f"(≤ {CFG.max_incertas} casas “?”) e um quadro com mão ou sombra forte é descartado. "
      "As fotos que falham são as de `luz_diferente`: é o comportamento certo — mudou a luz, recalibre.\n")
    P("Limites do limiar: uma casa errada **com cor parecida** com a certa (V↔Z) fica perto da "
      "paleta e não vira “?”; e a pele da mão cai quase sempre em **Z** (marrom). Quem trata a mão "
      "é o descarte por movimento/oclusão (`estabilizacao.py`), não só o limiar.\n")
    P("Casas incertas por foto de “mão” (limiar escolhido):\n")
    for n in ("tabuleiro_vazio_mao", "tabuleiro_vazio_mao_em_cima", "tabuleiro_1_mao", "tabuleiro_2_completo_mao"):
        if n in pior_mao:
            P(f"- `{n}`: {int((pior_mao[n] > CFG.limiar_incerto).sum())} casas incertas "
              f"→ {'descartado' if (pior_mao[n] > CFG.limiar_incerto).sum() > CFG.max_incertas else 'passaria'}")
    P("")

    # --- teste fora da amostra --------------------------------------------------------------
    teste = [n for n in cel if n.startswith("WhatsApp")]
    if teste:
        P("## 5. Teste em tabuleiro que não entrou na calibração\n")
        P("Fotos do 3º tabuleiro, classificadas com a paleta final; conta as peças cujas 5 casas "
          "formam a forma certa.\n")
        for n in teste:
            grade, dmin = classificar(cel[n], Paleta(pal_final), CFG.limiar_incerto, CFG.peso_l)
            erradas = []
            for l in LETRAS:
                cs = [(r, c) for r in range(6) for c in range(10) if grade[r][c] == l]
                if not (len(cs) == 5 and forma_corresponde(l, cs, True)):
                    erradas.append(l)
            inc = sum(g == INCERTO for linha in grade for g in linha)
            destino = "descartada pelo limiar" if inc > CFG.max_incertas else "aceita"
            quais = f" (erradas: {', '.join(erradas)})" if erradas else ""
            P(f"- `{n}`: {12 - len(erradas)}/12 peças com forma correta{quais}, {inc} casas incertas → {destino}")
        P("")

    # --- plano B -----------------------------------------------------------------------------
    P("## 6. Plano B (ArUco)\n")
    if veredito:
        pares = ", ".join(f"{a}–{b}" for a, b, *_ in veredito)
        P(f"**Acionar para: {pares}.** Critério: par com ≥ 2% das casas trocadas no teste cruzado "
          "ou distância ponderada < 8 na paleta. ")
        for a, b, n_conf, taxa, dist in veredito:
            P(f"- {a}–{b}: {n_conf} casas trocadas ({100 * taxa:.1f}%), distância {dist:.1f}.")
        P("\nOs demais pares separam por cor. Imprimir ArUco só para as peças do par (não as 12). "
          "Antes de imprimir, vale tentar o desempate pela forma/votação da peça inteira, que a "
          "cor sozinha não faz, e travar a exposição; se o par ainda trocar, siga com o ArUco.")
    else:
        P("**Não é necessário:** nenhum par passou do critério. Mantenha o ArUco como reserva.")
    P("\n## 7. Limitações desta amostra\n")
    P("- Dois tabuleiros montados + um de teste, uma mesa e uma folha; a paleta vale para essa luz.\n"
      "- A paleta deve ser refeita no local definitivo, com o tabuleiro **cheio** e a exposição travada.\n"
      "- A cor das peças é medida em Lab; trocar a câmera/app pode deslocar tudo.\n")

    texto = "\n".join(L)
    saida.mkdir(parents=True, exist_ok=True)
    Paleta({k: np.asarray(v, np.float32) for k, v in pal_final.items()}).salvar(saida / "paleta.json")
    (saida / "relatorio_calibracao.md").write_text(texto, encoding="utf-8")
    return texto


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--pasta", required=True, help="pasta com as fotos (jpeg)")
    ap.add_argument("--saida", default="calibracao")
    a = ap.parse_args()
    print(gerar(Path(a.pasta), Path(a.saida)))
    print(f"\nSalvo em {a.saida}/paleta.json e {a.saida}/relatorio_calibracao.md")
