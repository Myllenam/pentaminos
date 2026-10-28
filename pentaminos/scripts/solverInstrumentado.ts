
import { BoardConfig, Cell, PentominoId, PlacedPiece } from "@/lib/types/pentomino";
import { PENTOMINOES } from "@/lib/mocks/pentominos";
import { transformCells } from "@/lib/functions/pentominoGenerator";

const ROTATIONS: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];

interface Orientation {
  rotation: 0 | 90 | 180 | 270;
  cells: Cell[];
}

export interface InstanceInput {
  instanceId: string;
  shapeId: PentominoId;
}

export interface SolveMetrics {
  solved: boolean;
  placements: PlacedPiece[] | null;
  elapsedMs: number;
  nos: number;
  backtracks: number;
  podasIlha: number;
  atingiuLimiteDeNos: boolean;
  atingiuLimiteDeTempo: boolean;
}

export interface SolveOptions {

  usarPodaIlha?: boolean;

  maxNos?: number;

  maxTempoMs?: number;

  ignorarPecasIguais?: boolean;
}

function serializeCells(cells: Cell[]): string {
  return cells
    .map(([r, c]) => `${r},${c}`)
    .sort()
    .join("|");
}

function orientacoesDe(shapeId: PentominoId): Orientation[] {
  const shape = PENTOMINOES.find((s) => s.id === shapeId);
  if (!shape) return [];

  const vistas = new Set<string>();
  const orientacoes: Orientation[] = [];

  for (const rotation of ROTATIONS) {
    const cells = transformCells(shape.cells, rotation);
    const chave = serializeCells(cells);
    if (!vistas.has(chave)) {
      vistas.add(chave);
      orientacoes.push({ rotation, cells });
    }
  }
  return orientacoes;
}


function regioesVaziasSaoViaveis(
  grid: (string | null)[][],
  rows: number,
  cols: number,
): boolean {
  const visitado: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false),
  );

  for (let r0 = 0; r0 < rows; r0++) {
    for (let c0 = 0; c0 < cols; c0++) {
      if (grid[r0][c0] !== null || visitado[r0][c0]) continue;

      let tamanho = 0;
      const pilha: Cell[] = [[r0, c0]];
      visitado[r0][c0] = true;

      while (pilha.length > 0) {
        const [r, c] = pilha.pop()!;
        tamanho++;

        const vizinhos: Cell[] = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ];
        for (const [vr, vc] of vizinhos) {
          if (
            vr >= 0 &&
            vr < rows &&
            vc >= 0 &&
            vc < cols &&
            !visitado[vr][vc] &&
            grid[vr][vc] === null
          ) {
            visitado[vr][vc] = true;
            pilha.push([vr, vc]);
          }
        }
      }

      if (tamanho % 5 !== 0) return false;
    }
  }
  return true;
}

export function resolverInstrumentado(
  config: BoardConfig,
  pieces: InstanceInput[],
  options: SolveOptions = {},
): SolveMetrics {
  const {
    usarPodaIlha = true,
    maxNos = 3_000_000,
    maxTempoMs = 20_000,
    ignorarPecasIguais = false,
  } = options;
  const { rows, cols } = config;

  const inicio = performance.now();

  if (rows * cols !== pieces.length * 5) {
    return {
      solved: false,
      placements: null,
      elapsedMs: performance.now() - inicio,
      nos: 0,
      backtracks: 0,
      podasIlha: 0,
      atingiuLimiteDeNos: false,
      atingiuLimiteDeTempo: false,
    };
  }

  const grid: (string | null)[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(null),
  );

  const orientacoesPorShape = new Map<PentominoId, Orientation[]>();
  for (const { shapeId } of pieces) {
    if (!orientacoesPorShape.has(shapeId)) {
      orientacoesPorShape.set(shapeId, orientacoesDe(shapeId));
    }
  }

  const pool: InstanceInput[] = pieces.map(({ instanceId, shapeId }) => ({
    instanceId,
    shapeId,
  }));

  const placements: PlacedPiece[] = [];

  let nos = 0;
  let backtracks = 0;
  let podasIlha = 0;
  let limiteNosAtingido = false;
  let limiteTempoAtingido = false;

  function primeiraCelulaVazia(): Cell | null {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === null) return [r, c];
      }
    }
    return null;
  }

  function cabe(cells: Cell[], origemRow: number, origemCol: number): boolean {
    return cells.every(([dr, dc]) => {
      const r = origemRow + dr;
      const c = origemCol + dc;
      return r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] === null;
    });
  }

  function ocupar(cells: Cell[], or: number, oc: number, id: string) {
    cells.forEach(([dr, dc]) => {
      grid[or + dr][oc + dc] = id;
    });
  }

  function liberar(cells: Cell[], or: number, oc: number) {
    cells.forEach(([dr, dc]) => {
      grid[or + dr][oc + dc] = null;
    });
  }

  function estourouLimites(): boolean {
    if (nos > maxNos) {
      limiteNosAtingido = true;
      return true;
    }
    if (nos % 5000 === 0 && performance.now() - inicio > maxTempoMs) {
      limiteTempoAtingido = true;
      return true;
    }
    return false;
  }

  function backtrack(restantes: InstanceInput[]): boolean {
    nos++;
    if (estourouLimites()) return false;

    const vazia = primeiraCelulaVazia();
    if (!vazia) return true; 
    const [row, col] = vazia;

    const formasTentadas = ignorarPecasIguais ? new Set<PentominoId>() : null;

    for (let i = 0; i < restantes.length; i++) {
      const instancia = restantes[i];
      if (formasTentadas) {
        if (formasTentadas.has(instancia.shapeId)) continue;
        formasTentadas.add(instancia.shapeId);
      }
      const orientacoes = orientacoesPorShape.get(instancia.shapeId) ?? [];

      for (const orientacao of orientacoes) {
        for (const [dr, dc] of orientacao.cells) {
          const origemRow = row - dr;
          const origemCol = col - dc;

          if (!cabe(orientacao.cells, origemRow, origemCol)) continue;

          ocupar(orientacao.cells, origemRow, origemCol, instancia.instanceId);
          placements.push({
            instanceId: instancia.instanceId,
            shapeId: instancia.shapeId,
            rotation: orientacao.rotation,
            mirrored: false,
            origin: [origemRow, origemCol],
          });

          let restaViavel = true;
          if (restantes.length > 1 && usarPodaIlha) {
            restaViavel = regioesVaziasSaoViaveis(grid, rows, cols);
            if (!restaViavel) podasIlha++;
          }

          let sucesso = false;
          if (restaViavel) {
            const proximas = [
              ...restantes.slice(0, i),
              ...restantes.slice(i + 1),
            ];
            sucesso = backtrack(proximas);
          }

          if (sucesso) return true;

          backtracks++;
          placements.pop();
          liberar(orientacao.cells, origemRow, origemCol);

          if (limiteNosAtingido || limiteTempoAtingido) return false;
        }
      }
    }
    return false;
  }

  const sucesso = backtrack(pool);
  const elapsedMs = performance.now() - inicio;

  return {
    solved: sucesso,
    placements: sucesso ? placements : null,
    elapsedMs,
    nos,
    backtracks,
    podasIlha,
    atingiuLimiteDeNos: limiteNosAtingido,
    atingiuLimiteDeTempo: limiteTempoAtingido,
  };
}