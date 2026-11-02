"""Compara os modos "cor" e "forma" nas fotos reais."""
from __future__ import annotations

import argparse
import re
import time
from dataclasses import replace
from pathlib import Path

import cv2
import numpy as np

from calibrar_fotos import (FR, Alinhador, amostras, gabarito_das_sequencias,
                            gabarito_dos_casos_dificeis, paleta_mediana)
from config import Config
from forma import classificar_combinado, classificar_forma, distancia
from pentaminos import LETRAS
from validador import validar_estado
from visao import INCERTO, VAZIO, Paleta, classificar, cores_das_celulas

CFG = Config()
COMANDO = "cd pentaminos/visao && python comparar_modos.py --pasta fotos-pentaminos"


def carregar(pasta: Path):
    imgs = {p.stem: cv2.imread(str(p)) for p in sorted(pasta.glob("*.jp*g"))}
    alin = Alinhador(imgs["tabuleiro_vazio"])
    cel = {}
    for n, im in imgs.items():
        try:
            cel[n] = cores_das_celulas(alin.retificar(im), 6, 10, FR)
        except RuntimeError:
            pass
    gt = gabarito_das_sequencias(cel, list(cel))
    extra = gabarito_dos_casos_dificeis(cel, gt)
    return cel, gt, extra


def prever(cores, modo: str, pal: dict, cfg: Config, vazio) -> list[list[str]]:
    paleta = Paleta({k: np.asarray(v, np.float32) for k, v in pal.items()})
    if modo == "forma":
        return classificar_forma(cores, paleta, cfg, vazio)
    if modo == "combinado":
        return classificar_combinado(cores, paleta, cfg, vazio)
    return classificar(cores, paleta, cfg.limiar_incerto, cfg.peso_l)[0]


def medir(pred, gt) -> dict:
    casas = sum(pred[r][c] == gt[r][c] for r in range(6) for c in range(10))
    letras = {x for l in gt for x in l if x != VAZIO}
    pecas = sum(sorted((r, c) for r in range(6) for c in range(10) if pred[r][c] == l)
                == sorted((r, c) for r in range(6) for c in range(10) if gt[r][c] == l) for l in letras)
    estado = validar_estado(pred, CFG.pecas, CFG.espelhar)
    return {"casas": casas, "pecas": pecas, "n_pecas": len(letras), "vitoria": estado.vitoria,
            "completo": len(letras) == 12, "incertas": sum(x == INCERTO for l in pred for x in l),
            "validas": sum(p.valida for p in estado.pecas.values())}


def _pct(a, b) -> str:
    return f"{100 * a / b:.1f}%" if b else "—"


def _linha(*c) -> str:
    return "| " + " | ".join(str(x) for x in c) + " |"


class Comparacao:
    def __init__(self, pasta: Path):
        self.cel, self.gt, extra = carregar(pasta)
        self.vazio = np.median(np.stack([self.cel[n] for n in self.cel
                                         if re.fullmatch(r"tabuleiro_vazio(_\d)?", n)]), axis=0)
        self.b1 = [n for n in self.gt if re.match(r"tabu\w*ro_1_", n)]
        self.b2 = [n for n in self.gt if re.match(r"tabu\w*ro_2_", n)]
        self.mao = {n: g for n, g in extra.items() if "mao" in n}
        self.soltas = {n: g for n, g in extra.items() if "mao" not in n}
        X, y, _ = amostras(self.cel, self.gt, self.b1 + self.b2)
        self.pal_final = paleta_mediana(X, y)
        self.pal_de = {}
        for treino, teste in ((self.b2, self.b1), (self.b1, self.b2)):
            pal = paleta_mediana(*amostras(self.cel, self.gt, treino)[:2])
            self.pal_de.update({n: pal for n in teste})
        self.teste = sorted(n for n in self.cel if n.startswith("WhatsApp"))

    def com_gabarito(self) -> dict[str, list[list[str]]]:
        return {**self.gt, **self.soltas}

    def paleta(self, n: str) -> dict:
        return self.pal_de.get(n, self.pal_final)

    def resultados(self, modo: str, cfg: Config = CFG, fotos=None, com_vazio=True) -> dict[str, dict]:
        fotos = fotos or self.com_gabarito()
        vazio = self.vazio if com_vazio else None
        return {n: medir(prever(self.cel[n], modo, self.paleta(n), cfg, vazio), g)
                for n, g in fotos.items()}


def _resumo(res: dict[str, dict]) -> tuple:
    casas = sum(r["casas"] for r in res.values())
    pecas = sum(r["pecas"] for r in res.values())
    n_pecas = sum(r["n_pecas"] for r in res.values())
    comp = [r for r in res.values() if r["completo"]]
    falsas = sum(r["vitoria"] for r in res.values() if not r["completo"])
    return (_pct(casas, 60 * len(res)), _pct(pecas, n_pecas),
            f"{sum(r['vitoria'] for r in comp)}/{len(comp)}", falsas)


def gerar(pasta: Path, saida: Path) -> str:
    cp = Comparacao(pasta)
    L: list[str] = []
    P = L.append
    fotos = cp.com_gabarito()
    P("# Comparação dos modos de identificação: cor × forma\n")
    P(f"Gerado por `{COMANDO}` (script `comparar_modos.py`). Todas as tabelas abaixo saem dele.\n")
    P(f"**Fotos:** {len(cp.cel)} lidas e alinhadas. Com gabarito: {len(cp.gt)} das sequências dos "
      f"tabuleiros 1 e 2 (inclui as de `luz_diferente`) e {len(cp.soltas)} de peça sozinha. "
      "O gabarito é o do `calibrar_fotos.py` (casas novas de cada foto da sequência, nome pela forma). "
      f"Fotos com mão ({len(cp.mao)}) ficam fora das métricas de acerto e têm tabela própria.\n")
    P("**Paleta:** cruzada, como no relatório da calibração — fotos do tabuleiro 1 usam a paleta "
      "medida no tabuleiro 2 e vice-versa; peças soltas e o 3º tabuleiro usam a paleta dos dois. "
      "**Casa vazia (modo forma):** mediana por casa das fotos `tabuleiro_vazio*`.\n")
    P("**Atenção:** o gabarito marca casa ocupada por croma (cor saturada contra o papel), uma ideia "
      "parecida com a ocupação do modo forma; por isso a ocupação do modo forma tende a concordar com ele.\n")

    # 1. limiares
    P("## 1. Calibração dos limiares do modo forma\n")
    dv, do, mesma, outra = [], [], [], []
    for n in cp.b1 + cp.b2:
        g, c = cp.gt[n], cp.cel[n]
        d = distancia(c, cp.vazio, CFG.peso_l)
        for r in range(6):
            for k in range(10):
                (dv if g[r][k] == VAZIO else do).append(d[r, k])
                for rr, kk in ((r + 1, k), (r, k + 1)):
                    if rr < 6 and kk < 10 and VAZIO not in (g[r][k], g[rr][kk]):
                        x = float(distancia(c[r, k], c[rr, kk], CFG.peso_l))
                        (mesma if g[r][k] == g[rr][kk] else outra).append(x)
    dv, do, mesma, outra = map(np.array, (dv, do, mesma, outra))
    P(f"Distância (Lab, L×{CFG.peso_l}) até a casa vazia: vazias p99 {np.percentile(dv, 99):.1f}, "
      f"máx. {dv.max():.1f}; ocupadas mín. {do.min():.1f}, p1 {np.percentile(do, 1):.1f}. "
      f"Escolha: `limiar_ocupada = {CFG.limiar_ocupada}` com `margem_ocupada = {CFG.margem_ocupada}` "
      f"(vazia abaixo de {CFG.limiar_ocupada - CFG.margem_ocupada}, ocupada acima de "
      f"{CFG.limiar_ocupada + CFG.margem_ocupada}, “?” entre os dois).\n")
    P(f"Distância entre casas vizinhas: da mesma peça p95 {np.percentile(mesma, 95):.1f}, "
      f"p99 {np.percentile(mesma, 99):.1f}, máx. {mesma.max():.1f}; de peças diferentes "
      f"mín. {outra.min():.1f}, p5 {np.percentile(outra, 5):.1f}. Os intervalos se sobrepõem (V–Z, I–T, U–Y): "
      "abaixo do limiar as peças se juntam e a divisão por forma separa; acima, uma peça pode se partir.\n")
    P(_linha("limiar_mesma_peca", "casas certas", "peças certas", "vitórias (completos)", "vitórias falsas"))
    P(_linha("---", "---", "---", "---", "---"))
    seq = {n: cp.gt[n] for n in cp.b1 + cp.b2}
    for lim in (8, 10, 12, 14, 16, 18, 20, 24, 28, 32):
        marca = "  ← padrão" if lim == CFG.limiar_mesma_peca else ""
        P(_linha(f"{lim}{marca}", *_resumo(cp.resultados("forma", replace(CFG, limiar_mesma_peca=lim), seq))))
    P("\nA varredura usa as mesmas fotos da comparação; o 3º tabuleiro (seção 5) é o teste de fora. "
      f"Padrão {CFG.limiar_mesma_peca}: dentro da faixa que acerta tudo e com folga acima da maior "
      f"distância entre casas da mesma peça ({mesma.max():.1f}), para uma peça não se partir com outra luz.\n")

    # 2. geral
    rc, rf, rk = cp.resultados("cor"), cp.resultados("forma"), cp.resultados("combinado")
    P("## 2. Resultado geral (fotos com gabarito)\n")
    P(_linha("modo", "casas certas", "peças com nome e casas certos", "vitórias (tabuleiros completos)",
             "vitórias falsas (incompletos)"))
    P(_linha("---", "---", "---", "---", "---"))
    P(_linha("cor", *_resumo(rc)))
    P(_linha("forma", *_resumo(rf)))
    P(_linha("combinado (cor; se houver peça inválida ou “?”, forma)", *_resumo(rk)))
    rs = cp.resultados("forma", com_vazio=False)
    P(_linha("forma sem `vazio.json` (casa vazia = “.” da paleta)", *_resumo(rs)))
    tempos = {}
    for modo in ("cor", "forma", "combinado"):
        t0 = time.perf_counter()
        for _ in range(5):
            cp.resultados(modo)
        tempos[modo] = 1000 * (time.perf_counter() - t0) / (5 * len(fotos))
    P(f"\nTempo médio por foto só da etapa de rótulos (sem retificar): cor {tempos['cor']:.1f} ms, "
      f"forma {tempos['forma']:.1f} ms, combinado {tempos['combinado']:.1f} ms. O loop ao vivo roda a {CFG.fps_alvo} quadros/s (100 ms por quadro).\n")

    # 3. por número de peças
    P("## 3. Por número de peças no tabuleiro\n")
    P(_linha("peças", "fotos", "casas — cor", "casas — forma", "peças — cor", "peças — forma",
             "peças — combinado", "vitória — cor", "vitória — forma", "vitória — combinado"))
    P(_linha(*["---"] * 10))
    for k in range(1, 13):
        ns = [n for n in fotos if rc[n]["n_pecas"] == k]
        if not ns:
            continue
        c, f, b = {n: rc[n] for n in ns}, {n: rf[n] for n in ns}, {n: rk[n] for n in ns}
        vit = (lambda r: f"{sum(x['vitoria'] for x in r.values())}/{len(r)}") if k == 12 else (lambda r: "—")
        P(_linha(k, len(ns), _resumo(c)[0], _resumo(f)[0], _resumo(c)[1], _resumo(f)[1], _resumo(b)[1],
                 vit(c), vit(f), vit(b)))
    P("\nPeças certas = a letra do gabarito ocupa exatamente as mesmas casas na previsão. "
      "Vitória só existe com 12 peças; vitórias falsas com 1 a 11 peças: "
      f"cor {_resumo(rc)[3]}, forma {_resumo(rf)[3]}, combinado {_resumo(rk)[3]}.\n")

    # 4. fotos com mão
    P("## 4. Fotos com mão (devem ser descartadas)\n")
    P(f"O pipeline descarta o quadro com mais de {CFG.max_incertas} casas “?”.\n")
    P(_linha("foto", "“?” — cor", "“?” — forma", "vitória — cor", "vitória — forma"))
    P(_linha(*["---"] * 5))
    mc, mf = cp.resultados("cor", fotos=cp.mao), cp.resultados("forma", fotos=cp.mao)
    for n in cp.mao:
        P(_linha(f"`{n}`", mc[n]["incertas"], mf[n]["incertas"], mc[n]["vitoria"], mf[n]["vitoria"]))
    P("")

    # 5. 3º tabuleiro
    P("## 5. 3º tabuleiro (fora da calibração)\n")
    P("Estas fotos **não têm gabarito**: o `calibrar_fotos.py` só monta gabarito para as sequências "
      "(uma peça nova por foto) e para peças sozinhas. Por isso casas certas e peças certas não podem "
      "ser calculadas aqui. O tabuleiro está completo, então o certo é detectar vitória; também conto as "
      "peças válidas (5 casas com a forma da letra) e mostro a grade de cada modo para conferir na foto.\n")
    P(_linha("foto", "peças válidas — cor", "peças válidas — forma", "peças válidas — combinado",
             "“?” — cor", "“?” — forma", "vitória — cor", "vitória — forma", "vitória — combinado"))
    P(_linha(*["---"] * 9))
    grades, t3 = {}, {}
    for n in cp.teste:
        res = t3.setdefault(n, {})
        for modo in ("cor", "forma", "combinado"):
            g = prever(cp.cel[n], modo, cp.pal_final, CFG, cp.vazio)
            grades[(n, modo)] = g
            e = validar_estado(g, CFG.pecas, CFG.espelhar)
            res[modo] = (sum(p.valida for p in e.pecas.values()), sum(x == INCERTO for l in g for x in l), e.vitoria)
        P(_linha(f"`{n}`", f"{res['cor'][0]}/12", f"{res['forma'][0]}/12", f"{res['combinado'][0]}/12",
                 res["cor"][1], res["forma"][1], res["cor"][2], res["forma"][2], res["combinado"][2]))
    for n in cp.teste:
        P(f"\n`{n}` — cor | forma:\n\n```")
        for a, b in zip(grades[(n, "cor")], grades[(n, "forma")]):
            P("".join(a) + "   " + "".join(b))
        P("```")
    P("")
    P(recomendacao(rc, rf, rk, rs, t3, mc, mf))
    texto = "\n".join(L)
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(texto, encoding="utf-8")
    return texto


def recomendacao(rc, rf, rk, rs, t3, mc, mf) -> str:
    c, f, k, s = _resumo(rc), _resumo(rf), _resumo(rk), _resumo(rs)
    vit = {m: sum(r[m][2] for r in t3.values()) for m in ("cor", "forma", "combinado")}
    falhas = [n for n, r in t3.items() if not r["combinado"][2]]
    descarte = {m: sum(r["incertas"] > CFG.max_incertas for r in res.values()) for m, res in (("cor", mc), ("forma", mf))}
    linhas = [
        "## 6. Recomendação\n",
        f"**Padrão: `identificacao = \"{CFG.identificacao}\"`.** O modo combinado roda o modo cor e, quando "
        "ele tem peça inválida ou casa “?”, roda o forma e fica com o que tiver mais peças válidas (e menos “?”). Falta "
        "confirmar com uma partida ao vivo com a câmera real.\n",
        f"- Fotos com gabarito: casas certas cor {c[0]}, forma {f[0]}, combinado {k[0]}; peças certas "
        f"cor {c[1]}, forma {f[1]}, combinado {k[1]}; vitória nos tabuleiros completos cor {c[2]}, "
        f"forma {f[2]}, combinado {k[2]}. A diferença cresce com o número de peças (seção 3).",
        f"- 3º tabuleiro, fora da calibração: vitória em {vit['combinado']}/{len(t3)} fotos no combinado, "
        f"{vit['forma']}/{len(t3)} no forma e {vit['cor']}/{len(t3)} no cor.",
    ]
    for n in falhas:
        r = t3[n]
        linhas.append(f"  - `{n}` falha em todos os modos: {r['forma'][1]} casas “?” no forma e "
                      f"{r['cor'][1]} no cor (acima de {CFG.max_incertas} por quadro, o quadro é descartado).")
    linhas += [
        f"- Fotos com mão: descartadas em {descarte['forma']}/{len(mf)} (forma) e {descarte['cor']}/{len(mc)} (cor).",
        "- Custo: poucos milissegundos por quadro (seção 2), bem abaixo dos 100 ms do loop.\n",
        "**Limites desta medição:**\n",
        "- O gabarito dá nome às peças pela forma e marca ocupação por croma; isso favorece o modo forma "
        "no nome das peças. O que ele mede de forma independente é a separação de peças encostadas.",
        "- São só 3 tabuleiros completos com gabarito e 3 fotos de teste, uma mesa e uma luz.",
        "- Os limiares foram escolhidos nessas mesmas fotos; o 3º tabuleiro é o único teste de fora.",
        f"- Forma sem `vazio.json` (casa vazia = “.” da paleta): {s[0]} das casas, {s[1]} das peças, "
        f"vitória em {s[2]} (seção 2). Vale criá-lo no local definitivo "
        "(`python forma.py FOTO_DO_TABULEIRO_VAZIO`).",
    ]
    return "\n".join(linhas) + "\n"

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pasta", default="fotos-pentaminos")
    ap.add_argument("--saida", default="calibracao/comparacao_modos.md")
    a = ap.parse_args()
    print(gerar(Path(a.pasta), Path(a.saida)))
