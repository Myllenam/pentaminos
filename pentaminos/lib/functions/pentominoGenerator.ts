import {
  BoardConfig,
  Cell,
  PentominoId,
  PentominoShape,
  PlacedPiece,
} from "@/lib/types/pentomino";
import { PENTOMINOES } from "@/lib/mocks/pentominos";

export interface GeneratedBoard {
  config: BoardConfig;
  /** Peças na posição usada para gerar o tabuleiro — guardadas só para
   *  validar a solução do jogador depois, nunca renderizadas diretamente. */
  solutionPieces: PlacedPiece[];
  /** Mesmas peças com origin: null — é isso que vai para o banco de peças
   *  que o jogador recebe para resolver manualmente. */
  availablePieces: PlacedPiece[];
}

interface Orientation {
  cells: Cell[];
  rotation: 0 | 90 | 180 | 270;
}

// ---------- transformações geométricas ----------

function normalizeCells(cells: Cell[]): Cell[] {
  const minRow = Math.min(...cells.map(([r]) => r));
  const minCol = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minRow, c - minCol]);
}

function rotate90(cells: Cell[]): Cell[] {
  return normalizeCells(cells.map(([r, c]) => [c, -r]));
}

function serializeCells(cells: Cell[]): string {
  return cells
    .map(([r, c]) => `${r},${c}`)
    .sort()
    .join("|");
}

/**
 * Aplica apenas rotação a um shape base (sem espelhamento — não faz parte
 * das regras do jogo). Exportada porque o Board (e qualquer preview de
 * peça) precisa desenhar a peça na orientação real em que ela foi
 * colocada, não sempre na forma "crua" do catálogo.
 */
export function transformCells(
  cells: Cell[],
  rotation: 0 | 90 | 180 | 270,
): Cell[] {
  let current = normalizeCells(cells);
  const steps = rotation / 90;
  for (let i = 0; i < steps; i++) current = rotate90(current);
  return current;
}

function boundingBox(cells: Cell[]) {
  return {
    height: Math.max(...cells.map(([r]) => r)) + 1,
    width: Math.max(...cells.map(([, c]) => c)) + 1,
  };
}

export function getPieceCells(
  shape: PentominoShape,
  rotation: 0 | 90 | 180 | 270,
  origin: Cell,
): Cell[] {
  const transformedCells = transformCells(shape.cells, rotation);

  return transformedCells.map(([row, col]) => [
    origin[0] + row,
    origin[1] + col,
  ]);
}

export function canPlacePiece(
  shape: PentominoShape,
  rotation: 0 | 90 | 180 | 270,
  origin: Cell,
  config: BoardConfig,
  placedPieces: PlacedPiece[],
  ignorePieceId?: string,
): boolean {
  const cells = getPieceCells(shape, rotation, origin);

  // A peça inteira precisa estar dentro do tabuleiro.
 const isInsideBoard = cells.every(
  ([row, col]) =>
    row >= 0 &&
    row < config.rows &&
    col >= 0 &&
    col < config.cols,
);

if (!isInsideBoard) {
  return false;
}


  // Descobre todas as células ocupadas pelas outras peças.
  const occupiedCells = new Set<string>();

  placedPieces.forEach((piece) => {
    if (!piece.origin) return;

    if (piece.instanceId === ignorePieceId) {
      return;
    }

    const otherShape = PENTOMINOES.find((shape) => shape.id === piece.shapeId);

    if (!otherShape) return;

    const otherCells = getPieceCells(otherShape, piece.rotation, piece.origin);

    otherCells.forEach(([row, col]) => {
      occupiedCells.add(`${row}-${col}`);
    });
  });

  // Nenhuma célula da nova peça pode estar ocupada.
  return cells.every(([row, col]) => !occupiedCells.has(`${row}-${col}`));
}

/** Gera as orientações geometricamente distintas (apenas rotação) de uma peça. */
function generateOrientations(baseCells: Cell[]): Orientation[] {
  const seen = new Set<string>();
  const orientations: Orientation[] = [];
  const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];

  let current = normalizeCells(baseCells);
  for (const rotation of rotations) {
    const key = serializeCells(current);
    if (!seen.has(key)) {
      seen.add(key);
      orientations.push({ cells: current, rotation });
    }
    current = rotate90(current);
  }
  return orientations;
}

const ORIENTATIONS_BY_SHAPE = new Map<PentominoId, Orientation[]>(
  PENTOMINOES.map((shape) => [shape.id, generateOrientations(shape.cells)]),
);

function fitsInBoard(
  shapeId: PentominoId,
  rows: number,
  cols: number,
): boolean {
  return ORIENTATIONS_BY_SHAPE.get(shapeId)!.some((orientation) => {
    const box = boundingBox(orientation.cells);
    return box.height <= rows && box.width <= cols;
  });
}

// ---------- dimensões do tabuleiro ----------

/**
 * Calcula os pares (linhas x colunas) mais próximos da raiz quadrada da
 * área total, ordenados por proximidade — inclui também a versão
 * transposta de cada par, usada como alternativa quando o empacotamento
 * falha na orientação "principal".
 */
function calcularDimensoesCandidatas(quantidadePecas: number): BoardConfig[] {
  const area = quantidadePecas * 5;
  const divisores: Array<[number, number]> = [];

  for (let d = 1; d <= Math.sqrt(area); d++) {
    if (area % d === 0) divisores.push([d, area / d]);
  }
  divisores.sort(
    (a, b) =>
      Math.abs(a[0] - Math.sqrt(area)) - Math.abs(b[0] - Math.sqrt(area)),
  );

  const candidatos: BoardConfig[] = [];
  for (const [d, e] of divisores) {
    candidatos.push({ rows: d, cols: e });
    if (d !== e) candidatos.push({ rows: e, cols: d });
  }
  return candidatos;
}

// ---------- utilidades ----------

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function escolherPecas(
  quantidade: number,
  rows: number,
  cols: number,
  permitirRepeticao: boolean,
): PentominoId[] | null {
  const viaveis = PENTOMINOES.map((s) => s.id).filter((id) =>
    fitsInBoard(id, rows, cols),
  );
  if (viaveis.length === 0) return null;

  if (!permitirRepeticao) {
    if (viaveis.length < quantidade) return null;
    return embaralhar(viaveis).slice(0, quantidade);
  }

  return Array.from(
    { length: quantidade },
    () => viaveis[Math.floor(Math.random() * viaveis.length)],
  );
}

// ---------- empacotamento via backtracking ----------

interface Instancia {
  instanceId: string;
  shapeId: PentominoId;
}

const MAX_NOS_POR_TENTATIVA = 150_000;

function encaixarBacktracking(
  rows: number,
  cols: number,
  shapeIds: PentominoId[],
): PlacedPiece[] | null {
  const grid: (string | null)[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(null),
  );

  const orientacoesEmbaralhadas = new Map<PentominoId, Orientation[]>();
  for (const shapeId of new Set(shapeIds)) {
    orientacoesEmbaralhadas.set(
      shapeId,
      embaralhar(ORIENTATIONS_BY_SHAPE.get(shapeId)!),
    );
  }

  const pool: Instancia[] = shapeIds.map((shapeId, i) => ({
    instanceId: `piece-${shapeId}-${i}`,
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

  function ocupar(
    cells: Cell[],
    origemRow: number,
    origemCol: number,
    id: string,
  ) {
    cells.forEach(([dr, dc]) => {
      grid[origemRow + dr][origemCol + dc] = id;
    });
  }

  function liberar(cells: Cell[], origemRow: number, origemCol: number) {
    cells.forEach(([dr, dc]) => {
      grid[origemRow + dr][origemCol + dc] = null;
    });
  }

  // percorre a matriz célula a célula (via primeiraCelulaVazia); ao achar uma
  // vazia, tenta encaixar cada peça ainda não usada, em cada orientação
  function backtrack(restantes: Instancia[]): boolean {
    nos++;
    if (nos > MAX_NOS_POR_TENTATIVA) return false;

    const vazia = primeiraCelulaVazia();
    if (!vazia) return true; // tabuleiro cheio: sucesso
    const [row, col] = vazia;

    for (let i = 0; i < restantes.length; i++) {
      const instancia = restantes[i];
      const orientacoes = orientacoesEmbaralhadas.get(instancia.shapeId)!;

      for (const orientacao of orientacoes) {
        // ancora cada célula da peça na posição vazia encontrada
        for (const [dr, dc] of orientacao.cells) {
          const origemRow = row - dr;
          const origemCol = col - dc;

          if (cabe(orientacao.cells, origemRow, origemCol)) {
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

            const proximasRestantes = [
              ...restantes.slice(0, i),
              ...restantes.slice(i + 1),
            ];
            if (backtrack(proximasRestantes)) return true;

            // backtrack: desfaz a última jogada e tenta outra peça/orientação
            placements.pop();
            liberar(orientacao.cells, origemRow, origemCol);
          }
        }
      }
    }
    return false;
  }

  const sucesso = backtrack(embaralhar(pool));
  return sucesso ? placements : null;
}

// ---------- função principal ----------

const TENTATIVAS_SEM_REPETICAO = 40;
const TENTATIVAS_COM_REPETICAO = 60;

/**
 * Gera um tabuleiro completo e válido para `quantidadePecas` (3 a 12
 * peças), depois "quebra" essa configuração: devolve o board vazio
 * (config) e o banco de peças disponíveis (availablePieces, com
 * origin: null), mantendo a configuração original (solutionPieces)
 * apenas como referência interna de validação.
 *
 * Estratégia em 3 fases, para garantir que sempre existe uma solução:
 *  1. peças distintas embaralhadas (produz tabuleiros mais variados);
 *  2. se não encontrar em nenhuma dimensão candidata, permite repetir
 *     peças (necessário sobretudo para poucas peças, onde nem sempre
 *     existe combinação de pentaminós distintos que preencha a área exata);
 *  3. fallback determinístico com peças "I" em pé, que nunca falha.
 */
export function gerarTabuleiro(quantidadePecas: number): GeneratedBoard {
  const n = Math.min(Math.max(quantidadePecas, 3), 12);
  const candidatos = calcularDimensoesCandidatas(n);

  for (const { rows, cols } of candidatos) {
    for (let tentativa = 0; tentativa < TENTATIVAS_SEM_REPETICAO; tentativa++) {
      const pecas = escolherPecas(n, rows, cols, false);
      if (!pecas) break;
      const solucao = encaixarBacktracking(rows, cols, pecas);
      if (solucao) return montarResultado({ rows, cols }, solucao);
    }
  }

  for (const { rows, cols } of candidatos) {
    for (let tentativa = 0; tentativa < TENTATIVAS_COM_REPETICAO; tentativa++) {
      const pecas = escolherPecas(n, rows, cols, true);
      if (!pecas) continue;
      const solucao = encaixarBacktracking(rows, cols, pecas);
      if (solucao) return montarResultado({ rows, cols }, solucao);
    }
  }

  // fallback: linhas = 5 sempre divide a área (5 * n), então n peças "I"
  // em pé (uma por coluna) preenchem o tabuleiro por completo.
  const rows = 5;
  const cols = n;
  const solucaoFallback: PlacedPiece[] = Array.from({ length: n }, (_, i) => ({
    instanceId: `piece-I-${i}`,
    shapeId: "I" as PentominoId,
    rotation: 0,
    mirrored: false,
    origin: [0, i] as Cell,
  }));
  return montarResultado({ rows, cols }, solucaoFallback);
}

function montarResultado(
  config: BoardConfig,
  solutionPieces: PlacedPiece[],
): GeneratedBoard {
  return {
    config,
    solutionPieces,
    availablePieces: solutionPieces.map((piece) => ({
      ...piece,
      origin: null,
    })),
  };
}

export function getPreviewOrigin(
  cells: Cell[],
  hoveredCell: Cell,
): Cell {
  const minRow = Math.min(
    ...cells.map(([row]) => row),
  );

  const maxRow = Math.max(
    ...cells.map(([row]) => row),
  );

  const minCol = Math.min(
    ...cells.map(([, col]) => col),
  );

  const maxCol = Math.max(
    ...cells.map(([, col]) => col),
  );

  const centerRow = Math.floor(
    (minRow + maxRow) / 2,
  );

  const centerCol = Math.floor(
    (minCol + maxCol) / 2,
  );

  return [
    hoveredCell[0] - centerRow,
    hoveredCell[1] - centerCol,
  ];
}
