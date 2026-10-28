/**
 * Avaliação experimental do solver de Pentaminós — versão com repetições.
 *
 * Para cada quantidade de peças N, gera várias instâncias (tabuleiros
 * novos), resolve cada uma e calcula estatísticas (média, mediana, mínimo,
 * máximo e desvio padrão) de tempo, nós visitados, backtracks e podas.
 * Também compara o algoritmo COM e SEM a poda por regiões isoladas nas
 * mesmas instâncias.
 *
 * Como rodar (a partir da raiz do projeto):
 *
 *   npx tsx scripts/avaliarDesempenho.ts
 *
 * Opções por variável de ambiente (opcionais):
 *   REPETICOES=30   instâncias por N (padrão 30)
 *   SEED=12345      semente do sorteio (mesma semente = mesmas instâncias)
 *
 * Exemplo no PowerShell:   $env:REPETICOES=5; npx tsx scripts/avaliarDesempenho.ts
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { gerarTabuleiro } from "@/lib/functions/pentominoGenerator";
import {
  resolverInstrumentado,
  InstanceInput,
  SolveMetrics,
} from "./solverInstrumentado";

// ----------------------------------------------------------------------
// Configuração do experimento 
// ----------------------------------------------------------------------

const TAMANHOS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Instâncias por N. */
const REPETICOES = Number(process.env.REPETICOES ?? 30);

/** Para N >= TAMANHO_GRANDE usa-se menos repetições (podem ser bem mais lentas). */
const TAMANHO_GRANDE = 11;
const REPETICOES_GRANDES = Math.min(REPETICOES, 10);

/** Quantidades usadas na comparação com x sem poda por ilha. */
const TAMANHOS_COMPARACAO = [6, 7, 8, 9, 10];
const REPETICOES_COMPARACAO = REPETICOES;

/** Limite de tempo por instância (ms). Instâncias que estouram contam como "não resolvidas". */
const LIMITE_TEMPO_MS = 20_000;
const LIMITE_TEMPO_COMPARACAO_MS = 5_000;

/** Resoluções descartadas antes de medir, para o Node compilar o código (JIT). */
const AQUECIMENTO = 30;

/** Semente do gerador de números aleatórios (reprodutibilidade das instâncias). */
const SEED = Number(process.env.SEED ?? 12345);

const NIVEIS = [
  { nome: "Fácil", min: 3, max: 5 },
  { nome: "Médio", min: 6, max: 8 },
  { nome: "Difícil", min: 9, max: 12 },
];

const PASTA_SAIDA = path.join(process.cwd(), "scripts");


function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paraInput(gerado: ReturnType<typeof gerarTabuleiro>): InstanceInput[] {
  return gerado.availablePieces.map((p) => ({
    instanceId: p.instanceId,
    shapeId: p.shapeId,
  }));
}

interface Estat {
  media: number;
  mediana: number;
  min: number;
  max: number;
  dp: number;
}

function estatisticas(valores: number[]): Estat {
  const n = valores.length;
  if (n === 0) return { media: NaN, mediana: NaN, min: NaN, max: NaN, dp: NaN };
  const ord = [...valores].sort((a, b) => a - b);
  const media = valores.reduce((s, x) => s + x, 0) / n;
  const mediana = n % 2 ? ord[(n - 1) / 2] : (ord[n / 2 - 1] + ord[n / 2]) / 2;
  const dp =
    n > 1
      ? Math.sqrt(valores.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1))
      : 0;
  return { media, mediana, min: ord[0], max: ord[n - 1], dp };
}

function fmt(x: number): string {
  if (Number.isNaN(x)) return "-";
  if (x < 1) return x.toFixed(3);
  if (x < 100) return x.toFixed(2);
  return x.toFixed(1);
}

function fmtInt(x: number): string {
  if (Number.isNaN(x)) return "-";
  return Math.round(x).toLocaleString("pt-BR");
}

function pct(antes: number, depois: number): string {
  if (!(antes > 0)) return "-";
  return `${((1 - depois / antes) * 100).toFixed(1)}%`;
}

function csv(cabecalho: string[], linhas: (string | number)[][]): string {
  return [cabecalho.join(","), ...linhas.map((l) => l.join(","))].join("\n") + "\n";
}

function salvar(nome: string, conteudo: string) {
  fs.mkdirSync(PASTA_SAIDA, { recursive: true });
  const caminho = path.join(PASTA_SAIDA, nome);
  fs.writeFileSync(caminho, conteudo, "utf-8");
  console.log(`  salvo: ${caminho}`);
}


type Resultado = "resolvida" | "limite" | "sem-solucao";

interface Execucao {
  n: number;
  rep: number;
  tabuleiro: string;
  resultado: Resultado;
  tempo: number;
  nos: number;
  backtracks: number;
  podas: number;
}

function classificar(r: SolveMetrics): Resultado {
  if (r.atingiuLimiteDeTempo || r.atingiuLimiteDeNos) return "limite";
  return r.solved ? "resolvida" : "sem-solucao";
}

function aquecer() {
  for (let i = 0; i < AQUECIMENTO; i++) {
    const g = gerarTabuleiro(3 + (i % 6));
    resolverInstrumentado(g.config, paraInput(g), {
      usarPodaIlha: true,
      maxTempoMs: 1000,
    });
  }
}

function coletarPrincipal(): Execucao[] {
  const execucoes: Execucao[] = [];
  for (const n of TAMANHOS) {
    const reps = n >= TAMANHO_GRANDE ? REPETICOES_GRANDES : REPETICOES;
    process.stdout.write(`  N=${String(n).padStart(2)} (${reps} instâncias): `);
    for (let rep = 1; rep <= reps; rep++) {
      const g = gerarTabuleiro(n);
      const r = resolverInstrumentado(g.config, paraInput(g), {
        usarPodaIlha: true,
        maxTempoMs: LIMITE_TEMPO_MS,
      });
      execucoes.push({
        n,
        rep,
        tabuleiro: `${g.config.rows}x${g.config.cols}`,
        resultado: classificar(r),
        tempo: r.elapsedMs,
        nos: r.nos,
        backtracks: r.backtracks,
        podas: r.podasIlha,
      });
      process.stdout.write(".");
    }
    process.stdout.write("\n");
  }
  return execucoes;
}

function resumir(execs: Execucao[]) {
  return {
    total: execs.length,
    resolvidas: execs.filter((e) => e.resultado === "resolvida").length,
    tabuleiros: [...new Set(execs.map((e) => e.tabuleiro))].join("/"),
    tempo: estatisticas(execs.map((e) => e.tempo)),
    nos: estatisticas(execs.map((e) => e.nos)),
    backtracks: estatisticas(execs.map((e) => e.backtracks)),
    podas: estatisticas(execs.map((e) => e.podas)),
  };
}

function imprimirPorTamanho(execucoes: Execucao[]) {
  console.log("\n========================================");
  console.log("   RESULTADOS POR QUANTIDADE DE PEÇAS");
  console.log("========================================");
  console.log(
    "Instâncias que estouram o limite contam com o tempo em que foram interrompidas.\n",
  );

  console.log("TEMPO DE RESOLUÇÃO (ms)");
  console.log(
    "  N | Tabuleiro | Resolvidas |   Média | Mediana |     Mín |     Máx | Desv.Pad.",
  );
  console.log("-".repeat(86));
  for (const n of TAMANHOS) {
    const s = resumir(execucoes.filter((e) => e.n === n));
    console.log(
      `${String(n).padStart(3)} | ${s.tabuleiros.padEnd(9)} | ${`${s.resolvidas}/${s.total}`.padStart(10)} | ` +
        `${fmt(s.tempo.media).padStart(7)} | ${fmt(s.tempo.mediana).padStart(7)} | ${fmt(s.tempo.min).padStart(7)} | ` +
        `${fmt(s.tempo.max).padStart(7)} | ${fmt(s.tempo.dp).padStart(9)}`,
    );
  }

  console.log("\nTAMANHO DA BUSCA");
  console.log(
    "  N | Nós (média) | Nós (mediana) |   Nós (máx) | Backtr. (média) | Backtr. (mediana) | Podas (média)",
  );
  console.log("-".repeat(108));
  for (const n of TAMANHOS) {
    const s = resumir(execucoes.filter((e) => e.n === n));
    console.log(
      `${String(n).padStart(3)} | ${fmtInt(s.nos.media).padStart(11)} | ${fmtInt(s.nos.mediana).padStart(13)} | ` +
        `${fmtInt(s.nos.max).padStart(11)} | ${fmtInt(s.backtracks.media).padStart(15)} | ` +
        `${fmtInt(s.backtracks.mediana).padStart(17)} | ${fmtInt(s.podas.media).padStart(13)}`,
    );
  }
}

function imprimirPorNivel(execucoes: Execucao[]) {
  console.log("\n========================================");
  console.log("     RESULTADOS POR NÍVEL DE DIFICULDADE");
  console.log("========================================");

  const grupos = NIVEIS.map((nv) => ({
    ...nv,
    resumo: resumir(execucoes.filter((e) => e.n >= nv.min && e.n <= nv.max)),
  }));

  console.log(
    "\nNível:            " +
      grupos.map((g) => `${g.nome} (N=${g.min}-${g.max})`.padStart(20)).join(""),
  );
  console.log(
    "Resolvidas:       " +
      grupos.map((g) => `${g.resumo.resolvidas}/${g.resumo.total}`.padStart(20)).join(""),
  );

  const linha = (rotulo: string, f: (r: ReturnType<typeof resumir>) => string) =>
    console.log(rotulo.padEnd(18) + grupos.map((g) => f(g.resumo).padStart(20)).join(""));

  console.log("\nTempo (ms)");
  linha("  Média", (r) => fmt(r.tempo.media));
  linha("  Mediana", (r) => fmt(r.tempo.mediana));
  linha("  Mínimo", (r) => fmt(r.tempo.min));
  linha("  Máximo", (r) => fmt(r.tempo.max));
  linha("  Desv. padrão", (r) => fmt(r.tempo.dp));

  console.log("\nNós visitados");
  linha("  Média", (r) => fmtInt(r.nos.media));
  linha("  Mediana", (r) => fmtInt(r.nos.mediana));
  linha("  Mínimo", (r) => fmtInt(r.nos.min));
  linha("  Máximo", (r) => fmtInt(r.nos.max));
  linha("  Desv. padrão", (r) => fmtInt(r.nos.dp));
}

function imprimirDerivadas(execucoes: Execucao[]) {
  console.log("\n========================================");
  console.log("          MÉTRICAS DERIVADAS");
  console.log("========================================");

  const media = (n: number, f: (e: Execucao) => number) =>
    estatisticas(execucoes.filter((e) => e.n === n).map(f)).media;

  const a = 6;
  const b = 12;
  if (TAMANHOS.includes(a) && TAMANHOS.includes(b)) {
    const fator = (f: (e: Execucao) => number) =>
      Math.pow(media(b, f) / media(a, f), 1 / (b - a));
    console.log(
      `Crescimento por peça adicional entre N=${a} e N=${b} ((média em N=${b} / média em N=${a})^(1/${b - a})):`,
    );
    console.log(`  tempo médio: x${fator((e) => e.tempo).toFixed(2)}`);
    console.log(`  nós visitados (média): x${fator((e) => e.nos).toFixed(2)}`);
  }

  console.log("\nParcela dos backtracks que corresponde a podas por ilha (média de podas / média de backtracks):");
  for (const n of TAMANHOS) {
    const bt = media(n, (e) => e.backtracks);
    const pd = media(n, (e) => e.podas);
    console.log(`  N=${String(n).padStart(2)}: ${bt > 0 ? ((pd / bt) * 100).toFixed(1) + "%" : "-"}`);
  }
}

interface LinhaComparacao {
  n: number;
  instancias: number;
  semResolvidas: number;
  comResolvidas: number;
  nosSem: Estat;
  nosCom: Estat;
  btSem: Estat;
  btCom: Estat;
  tempoSem: Estat;
  tempoCom: Estat;
}

function compararPoda(): LinhaComparacao[] {
  const linhas: LinhaComparacao[] = [];
  for (const n of TAMANHOS_COMPARACAO) {
    process.stdout.write(`  N=${String(n).padStart(2)} (${REPETICOES_COMPARACAO} instâncias): `);
    const nosSem: number[] = [], nosCom: number[] = [];
    const btSem: number[] = [], btCom: number[] = [];
    const tSem: number[] = [], tCom: number[] = [];
    let semOk = 0, comOk = 0;

    for (let rep = 0; rep < REPETICOES_COMPARACAO; rep++) {
      const g = gerarTabuleiro(n);
      const pieces = paraInput(g);
      const rodar = (usarPodaIlha: boolean) =>
        resolverInstrumentado(g.config, pieces, {
          usarPodaIlha,
          maxTempoMs: LIMITE_TEMPO_COMPARACAO_MS,
        });

      let sem: SolveMetrics, com: SolveMetrics;
      if (rep % 2 === 0) {
        sem = rodar(false);
        com = rodar(true);
      } else {
        com = rodar(true);
        sem = rodar(false);
      }

      nosSem.push(sem.nos); nosCom.push(com.nos);
      btSem.push(sem.backtracks); btCom.push(com.backtracks);
      tSem.push(sem.elapsedMs); tCom.push(com.elapsedMs);
      if (classificar(sem) === "resolvida") semOk++;
      if (classificar(com) === "resolvida") comOk++;
      process.stdout.write(".");
    }
    process.stdout.write("\n");

    linhas.push({
      n,
      instancias: REPETICOES_COMPARACAO,
      semResolvidas: semOk,
      comResolvidas: comOk,
      nosSem: estatisticas(nosSem),
      nosCom: estatisticas(nosCom),
      btSem: estatisticas(btSem),
      btCom: estatisticas(btCom),
      tempoSem: estatisticas(tSem),
      tempoCom: estatisticas(tCom),
    });
  }
  return linhas;
}

function imprimirComparacao(linhas: LinhaComparacao[]) {
  console.log("\n========================================");
  console.log("   EFEITO DA PODA POR ILHA (flood fill)");
  console.log("========================================");
  console.log(
    `Mesmas instâncias resolvidas sem e com a poda (limite de ${LIMITE_TEMPO_COMPARACAO_MS / 1000}s por resolução).\n`,
  );
  console.log(
    "  N | Resolvidas s/c | Nós média (sem → com) | Redução | Nós mediana (sem → com) | Redução | Tempo média ms (sem → com) | Redução",
  );
  console.log("-".repeat(140));
  for (const l of linhas) {
    console.log(
      `${String(l.n).padStart(3)} | ${`${l.semResolvidas}/${l.comResolvidas} de ${l.instancias}`.padStart(14)} | ` +
        `${`${fmtInt(l.nosSem.media)} → ${fmtInt(l.nosCom.media)}`.padStart(21)} | ${pct(l.nosSem.media, l.nosCom.media).padStart(7)} | ` +
        `${`${fmtInt(l.nosSem.mediana)} → ${fmtInt(l.nosCom.mediana)}`.padStart(23)} | ${pct(l.nosSem.mediana, l.nosCom.mediana).padStart(7)} | ` +
        `${`${fmt(l.tempoSem.media)} → ${fmt(l.tempoCom.media)}`.padStart(26)} | ${pct(l.tempoSem.media, l.tempoCom.media).padStart(7)}`,
    );
  }
  console.log(
    "\nObs.: quando uma resolução é interrompida pelo limite, os valores medidos são um mínimo (a busca real seria maior).",
  );
}


function main() {
  Math.random = mulberry32(SEED);

  const cpu = os.cpus()[0];
  console.log("========================================");
  console.log("   AVALIAÇÃO EXPERIMENTAL — PENTAMINÓS");
  console.log("========================================");
  console.log(`Ambiente: ${os.type()} ${os.release()} | ${cpu?.model?.trim() ?? "CPU desconhecida"} (${os.cpus().length} threads) | ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB RAM | Node ${process.version}`);
  console.log(`Semente: ${SEED} | Repetições por N: ${REPETICOES} (N>=${TAMANHO_GRANDE}: ${REPETICOES_GRANDES}) | Limite por instância: ${LIMITE_TEMPO_MS / 1000}s\n`);

  console.log(`Aquecimento (${AQUECIMENTO} resoluções descartadas)...`);
  aquecer();

  console.log("\nColetando resultados principais...");
  const execucoes = coletarPrincipal();

  imprimirPorTamanho(execucoes);
  imprimirPorNivel(execucoes);
  imprimirDerivadas(execucoes);

  console.log("\nColetando comparação com/sem poda...");
  const comparacao = compararPoda();
  imprimirComparacao(comparacao);

  console.log("\nSalvando arquivos CSV...");
  salvar(
    "resultados-execucoes.csv",
    csv(
      ["n", "rep", "tabuleiro", "resultado", "tempo_ms", "nos", "backtracks", "podas_ilha"],
      execucoes.map((e) => [e.n, e.rep, e.tabuleiro, e.resultado, e.tempo.toFixed(3), e.nos, e.backtracks, e.podas]),
    ),
  );
  salvar(
    "resultados-resumo.csv",
    csv(
      ["n", "tabuleiros", "resolvidas", "total", "tempo_media", "tempo_mediana", "tempo_min", "tempo_max", "tempo_dp", "nos_media", "nos_mediana", "nos_max", "backtracks_media", "backtracks_mediana", "podas_media"],
      TAMANHOS.map((n) => {
        const s = resumir(execucoes.filter((e) => e.n === n));
        return [n, s.tabuleiros, s.resolvidas, s.total, s.tempo.media.toFixed(3), s.tempo.mediana.toFixed(3), s.tempo.min.toFixed(3), s.tempo.max.toFixed(3), s.tempo.dp.toFixed(3), s.nos.media.toFixed(1), s.nos.mediana.toFixed(1), s.nos.max, s.backtracks.media.toFixed(1), s.backtracks.mediana.toFixed(1), s.podas.media.toFixed(1)];
      }),
    ),
  );
  salvar(
    "resultados-comparacao-poda.csv",
    csv(
      ["n", "instancias", "resolvidas_sem", "resolvidas_com", "nos_media_sem", "nos_media_com", "nos_mediana_sem", "nos_mediana_com", "backtracks_media_sem", "backtracks_media_com", "tempo_media_sem", "tempo_media_com"],
      comparacao.map((l) => [l.n, l.instancias, l.semResolvidas, l.comResolvidas, l.nosSem.media.toFixed(1), l.nosCom.media.toFixed(1), l.nosSem.mediana.toFixed(1), l.nosCom.mediana.toFixed(1), l.btSem.media.toFixed(1), l.btCom.media.toFixed(1), l.tempoSem.media.toFixed(3), l.tempoCom.media.toFixed(3)]),
    ),
  );
}

main();