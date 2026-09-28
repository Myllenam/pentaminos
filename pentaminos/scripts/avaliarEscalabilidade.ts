/**
 * Teste de escalabilidade do solver de Pentaminós: instâncias com MAIS de 12 peças.
 *
 * Só existem 12 pentaminós distintos, então acima de 12 as peças se repetem
 * (equivale a usar mais de um conjunto completo). O gerador do jogo limita N a 12,
 * por isso este script tem um gerador próprio, que NÃO altera o código do jogo:
 * sorteia um empacotamento aleatório de um tabuleiro 5xN (solução garantida por
 * construção), com no máximo ceil(N/12) cópias de cada peça, e entrega ao solver
 * apenas o conjunto de peças, embaralhado.
 *
 * Cada instância é resolvida de duas formas:
 *   - "padrão": exatamente como o solver do jogo (peças iguais são tratadas como distintas);
 *   - "agrupando iguais": em cada nó só uma peça de cada forma é tentada.
 *
 * Como rodar (a partir da raiz do projeto):
 *   npx tsx scripts/avaliarEscalabilidade.ts
 *
 * Opções por variável de ambiente (PowerShell: $env:NOME=valor):
 *   REPETICOES=10   instâncias por N (padrão 10)
 *   TAMANHOS=13,14,15,16   lista de N (padrão 12 a 18)
 *   LIMITE_S=20     limite de tempo por resolução, em segundos (padrão 20)
 *   SEED=12345      semente
 * O script para de aumentar N quando nenhuma instância de um N é resolvida no limite.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { transformCells } from "@/lib/functions/pentominoGenerator";
import { PENTOMINOES } from "@/lib/mocks/pentominos";
import { Cell, PentominoId } from "@/lib/types/pentomino";
import {
  resolverInstrumentado,
  InstanceInput,
  SolveMetrics,
} from "./solverInstrumentado";


const TAMANHOS = (process.env.TAMANHOS ?? "12,13,14,15,16,17,18")
  .split(",")
  .map((x) => Number(x.trim()))
  .filter((x) => x >= 3);
const REPETICOES = Number(process.env.REPETICOES ?? 10);
const LIMITE_TEMPO_MS = Number(process.env.LIMITE_S ?? 20) * 1000;
const SEED = Number(process.env.SEED ?? 12345);
const AQUECIMENTO = 20;
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

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

interface Estat { media: number; mediana: number; min: number; max: number; dp: number }

function estatisticas(v: number[]): Estat {
  const n = v.length;
  if (n === 0) return { media: NaN, mediana: NaN, min: NaN, max: NaN, dp: NaN };
  const o = [...v].sort((a, b) => a - b);
  const media = v.reduce((s, x) => s + x, 0) / n;
  const mediana = n % 2 ? o[(n - 1) / 2] : (o[n / 2 - 1] + o[n / 2]) / 2;
  const dp = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1)) : 0;
  return { media, mediana, min: o[0], max: o[n - 1], dp };
}

function fmt(x: number): string {
  if (Number.isNaN(x)) return "-";
  if (x < 1) return x.toFixed(3);
  if (x < 100) return x.toFixed(2);
  return x.toFixed(1);
}
function fmtInt(x: number): string {
  return Number.isNaN(x) ? "-" : Math.round(x).toLocaleString("pt-BR");
}



function orientacoesUnicas(id: PentominoId): Cell[][] {
  const shape = PENTOMINOES.find((s) => s.id === id)!;
  const vistas = new Set<string>();
  const res: Cell[][] = [];
  for (const rot of [0, 90, 180, 270] as const) {
    const cells = transformCells(shape.cells, rot);
    const chave = cells.map(([r, c]) => `${r},${c}`).sort().join("|");
    if (!vistas.has(chave)) {
      vistas.add(chave);
      res.push(cells);
    }
  }
  return res;
}

const IDS = PENTOMINOES.map((s) => s.id);
const ORIENTACOES = new Map<PentominoId, Cell[][]>(IDS.map((id) => [id, orientacoesUnicas(id)]));


function gerarInstancia(n: number): { rows: number; cols: number; pieces: InstanceInput[] } {
  const rows = 5;
  const cols = n;
  const maxCopias = Math.ceil(n / 12);

  for (let tentativa = 0; tentativa < 200; tentativa++) {
    const grid: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const uso = new Map<PentominoId, number>();
    const usadas: PentominoId[] = [];
    let nos = 0;


    const primeiraVazia = (): Cell | null => {
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++) if (!grid[r][c]) return [r, c];
      return null;
    };

    const bt = (): boolean => {
      if (++nos > 200_000) return false;
      const v = primeiraVazia();
      if (!v) return true;
      const [r, c] = v;
      for (const id of embaralhar(IDS)) {
        if ((uso.get(id) ?? 0) >= maxCopias) continue;
        for (const cells of embaralhar(ORIENTACOES.get(id)!)) {
          for (const [dr, dc] of cells) {
            const or = r - dr;
            const oc = c - dc;
            const cabe = cells.every(([a, b]) => {
              const rr = or + a, cc = oc + b;
              return rr >= 0 && rr < rows && cc >= 0 && cc < cols && !grid[rr][cc];
            });
            if (!cabe) continue;
            cells.forEach(([a, b]) => (grid[or + a][oc + b] = true));
            uso.set(id, (uso.get(id) ?? 0) + 1);
            usadas.push(id);
            if (bt()) return true;
            usadas.pop();
            uso.set(id, (uso.get(id) ?? 1) - 1);
            cells.forEach(([a, b]) => (grid[or + a][oc + b] = false));
          }
        }
      }
      return false;
    };

    if (bt()) {
      const pieces = embaralhar(usadas).map((shapeId, i) => ({
        instanceId: `piece-${shapeId}-${i}`,
        shapeId,
      }));
      return { rows, cols, pieces };
    }
  }
  throw new Error(`Não foi possível gerar instância com ${n} peças.`);
}


type Variante = "padrao" | "agrupando";
type Resultado = "resolvida" | "limite" | "sem-solucao";

interface Execucao {
  n: number;
  rep: number;
  variante: Variante;
  distintas: number;
  resultado: Resultado;
  tempo: number;
  nos: number;
  backtracks: number;
}

function classificar(r: SolveMetrics): Resultado {
  if (r.atingiuLimiteDeTempo || r.atingiuLimiteDeNos) return "limite";
  return r.solved ? "resolvida" : "sem-solucao";
}

function main() {
  Math.random = mulberry32(SEED);
  const cpu = os.cpus()[0];
  console.log("========================================");
  console.log("  ESCALABILIDADE — MAIS DE 12 PEÇAS");
  console.log("========================================");
  console.log(`Ambiente: ${os.type()} ${os.release()} | ${cpu?.model?.trim() ?? "CPU"} (${os.cpus().length} threads) | ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB RAM | Node ${process.version}`);
  console.log(`Semente: ${SEED} | Instâncias por N: ${REPETICOES} | Limite por resolução: ${LIMITE_TEMPO_MS / 1000}s | Tabuleiro: 5xN\n`);

  console.log("Aquecimento...");
  for (let i = 0; i < AQUECIMENTO; i++) {
    const g = gerarInstancia(6 + (i % 4));
    resolverInstrumentado({ rows: g.rows, cols: g.cols }, g.pieces, { maxTempoMs: 1000 });
  }

  const execucoes: Execucao[] = [];
  const linhas: string[] = [];

  for (const n of TAMANHOS) {
    process.stdout.write(`\nN=${n}: `);
    let resolvidasNoN = 0;
    for (let rep = 1; rep <= REPETICOES; rep++) {
      const g = gerarInstancia(n);
      const distintas = new Set(g.pieces.map((p) => p.shapeId)).size;
      for (const variante of ["padrao", "agrupando"] as Variante[]) {
        const r = resolverInstrumentado({ rows: g.rows, cols: g.cols }, g.pieces, {
          usarPodaIlha: true,
          ignorarPecasIguais: variante === "agrupando",
          maxTempoMs: LIMITE_TEMPO_MS,
        });
        const res = classificar(r);
        if (variante === "padrao" && res === "resolvida") resolvidasNoN++;
        execucoes.push({
          n, rep, variante, distintas, resultado: res,
          tempo: r.elapsedMs, nos: r.nos, backtracks: r.backtracks,
        });
      }
      process.stdout.write(".");
    }
    process.stdout.write("\n");

    for (const variante of ["padrao", "agrupando"] as Variante[]) {
      const e = execucoes.filter((x) => x.n === n && x.variante === variante);
      const ok = e.filter((x) => x.resultado === "resolvida").length;
      const t = estatisticas(e.map((x) => x.tempo));
      const nos = estatisticas(e.map((x) => x.nos));
      linhas.push(
        `${String(n).padStart(3)} | ${(variante === "padrao" ? "padrão" : "agrupando iguais").padEnd(16)} | ${`${ok}/${e.length}`.padStart(10)} | ` +
          `${fmt(t.media).padStart(9)} | ${fmt(t.mediana).padStart(9)} | ${fmt(t.min).padStart(8)} | ${fmt(t.max).padStart(9)} | ` +
          `${fmtInt(nos.media).padStart(11)} | ${fmtInt(nos.mediana).padStart(11)}`,
      );
      console.log(linhas[linhas.length - 1]);
    }

    if (resolvidasNoN === 0) {
      console.log(`\nNenhuma instância de ${n} peças foi resolvida no limite (variante padrão) — interrompendo.`);
      break;
    }
  }

  console.log("\n========================================");
  console.log("          RESULTADO FINAL");
  console.log("========================================");
  console.log("Instâncias que estouram o limite contam com o tempo em que foram interrompidas (valor mínimo).\n");
  console.log("  N | Variante         | Resolvidas | Tempo méd | Tempo med | Tempo mín | Tempo máx |  Nós (méd.) | Nós (med.)");
  console.log("-".repeat(122));
  linhas.forEach((l) => console.log(l));

  fs.mkdirSync(PASTA_SAIDA, { recursive: true });
  const cab = "n,rep,variante,formas_distintas,resultado,tempo_ms,nos,backtracks\n";
  const corpo = execucoes
    .map((e) => [e.n, e.rep, e.variante, e.distintas, e.resultado, e.tempo.toFixed(3), e.nos, e.backtracks].join(","))
    .join("\n");
  const caminho = path.join(PASTA_SAIDA, "resultados-escalabilidade.csv");
  fs.writeFileSync(caminho, cab + corpo + "\n", "utf-8");
  console.log(`\nsalvo: ${caminho}`);
}

main();