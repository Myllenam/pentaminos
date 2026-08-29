import { BoardConfig, Cell, PentominoId, PlacedPiece } from "@/lib/types/pentomino";
import { PENTOMINOES } from "@/lib/mocks/pentominos";
import { transformCells } from "@/lib/functions/pentominoGenerator";

import type { SolveRequestPiece } from "@/lib/workers/solverMessages";

/**
 * Estratégia de Resolução Automática (documento de requisitos, seção 11.4).
 *
 * Reutiliza o mesmo motor de encaixe da geração — coordenadas relativas por
 * orientação, verificação de limites e colisão em O(1) sobre uma matriz —,
 * porém partindo do tabuleiro vazio e de um conjunto fixo de peças, sem
 * aleatoriedade: o objetivo é encontrar qualquer disposição válida o mais
 * rápido possível.
 *
 * Este módulo é puro (sem React, sem DOM) justamente para poder rodar dentro
 * de um Web Worker.
 */

const ROTATIONS: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];

interface Orientation {
  rotation: 0 | 90 | 180 | 270;
  /** células normalizadas (menor linha/coluna em 0). */
  cells: Cell[];
}

/** Teto de nós visitados por chamada — protege o RNF07 (resposta em ≤ 10 s). */
const MAX_NOS = 3_000_000;

function serializeCells(cells: Cell[]): string {
  return cells
    .map(([r, c]) => `${r},${c}`)
    .sort()
    .join("|");
}

/** Orientações geometricamente distintas (apenas rotação, sem espelhamento). */
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

/**
 * Poda por "ilhas isoladas": toda região vazia conectada precisa ter um
 * número de células múltiplo de 5, senão nenhum pentaminó conseguirá
 * preenchê-la e o ramo pode ser abandonado de imediato (flood fill).
 */
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

interface Instancia {
  instanceId: string;
  shapeId: PentominoId;
}

/**
 * Encontra uma disposição válida das `pieces` que preencha 100% do tabuleiro
 * `config`. Retorna as peças posicionadas (com `origin` definido) ou `null`
 * quando nenhuma solução é achada dentro do limite de busca.
 */
export function resolverTabuleiro(
  config: BoardConfig,
  pieces: SolveRequestPiece[],
): PlacedPiece[] | null {
  const { rows, cols } = config;

  // Sanidade: área do tabuleiro tem de bater com 5 células por peça.
  if (rows * cols !== pieces.length * 5) return null;

  const grid: (string | null)[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(null),
  );

  const orientacoesPorShape = new Map<PentominoId, Orientation[]>();
  for (const { shapeId } of pieces) {
    if (!orientacoesPorShape.has(shapeId)) {
      orientacoesPorShape.set(shapeId, orientacoesDe(shapeId));
    }
  }

  const pool: Instancia[] = pieces.map(({ instanceId, shapeId }) => ({
    instanceId,
    shapeId,
  }));

  const placements: PlacedPiece[] = [];
  let nos = 0;

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

  function backtrack(restantes: Instancia[]): boolean {
    nos++;
    if (nos > MAX_NOS) return false;

    const vazia = primeiraCelulaVazia();
    if (!vazia) return true; // tabuleiro cheio: solução encontrada
    const [row, col] = vazia;

    for (let i = 0; i < restantes.length; i++) {
      const instancia = restantes[i];
      const orientacoes = orientacoesPorShape.get(instancia.shapeId) ?? [];

      for (const orientacao of orientacoes) {
        // ancora cada célula da peça na primeira célula vazia
        for (const [dr, dc] of orientacao.cells) {
          const origemRow = row - dr;
          const origemCol = col - dc;

          if (!cabe(orientacao.cells, origemRow, origemCol)) continue;

          ocupar(
            orientacao.cells,
            origemRow,
            origemCol,
            instancia.instanceId,
          );
          placements.push({
            instanceId: instancia.instanceId,
            shapeId: instancia.shapeId,
            rotation: orientacao.rotation,
            mirrored: false,
            origin: [origemRow, origemCol],
          });

          const restaViavel =
            restantes.length === 1 ||
            regioesVaziasSaoViaveis(grid, rows, cols);

          if (restaViavel) {
            const proximas = [
              ...restantes.slice(0, i),
              ...restantes.slice(i + 1),
            ];
            if (backtrack(proximas)) return true;
          }

          // backtrack: desfaz e tenta a próxima orientação/peça
          placements.pop();
          liberar(orientacao.cells, origemRow, origemCol);
        }
      }
    }
    return false;
  }

  return backtrack(pool) ? placements : null;
}
