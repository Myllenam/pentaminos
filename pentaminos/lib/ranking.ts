import { getPieceCells } from "@/lib/functions/pentominoGenerator";
import { PENTOMINOES } from "@/lib/mocks/pentominos";
import type {
  BoardConfig,
  Cell,
  PentominoId,
  PlacedPiece,
} from "@/lib/types/pentomino";

export type GameMode = "digital" | "fisico";

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  digital: "Digital",
  fisico: "Físico",
};

export function parseGameMode(
  value: string | null | undefined,
): GameMode {
  return value === "fisico" ? "fisico" : "digital";
}

// Uma peça na ordem em que foi colocada
// no tabuleiro final.
export interface PlacementStep {
  order: number;
  shapeId: PentominoId;
  rotation: PlacedPiece["rotation"];
  origin: Cell;
}

// Tabuleiro final: cada célula guarda a
// letra da peça que a ocupa.
export type FinalBoard = (PentominoId | null)[][];

export interface RankingEntry {
  id: string;
  player: string;
  time: string;
  pieces: number;
  moves?: number;
  date: string;
  autoSolved?: boolean;
  // Resultados antigos não têm modo
  // e são tratados como "digital".
  mode?: GameMode;
  placements?: PlacementStep[];
  finalBoard?: FinalBoard;
}

export type NewRankingEntry = Omit<RankingEntry, "id">;

export type RankingSort = "time" | "moves";

export interface GetRankingOptions {
  pieces?: number;
  mode?: GameMode;
  sortBy?: RankingSort;
}

const STORAGE_KEY = "pentaminos:ranking";

// Quando definida, o ranking é lido e salvo
// pelo backend. Sem ela, usa o localStorage.
const RANKING_API_URL =
  process.env.NEXT_PUBLIC_RANKING_API_URL?.replace(
    /\/+$/,
    "",
  );

function timeToSeconds(time: string): number {
  const [minutes, seconds] = time.split(":").map(Number);

  return (minutes || 0) * 60 + (seconds || 0);
}

function sortRanking(
  entries: RankingEntry[],
  sortBy: RankingSort = "time",
): RankingEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = timeToSeconds(a.time);
    const bTime = timeToSeconds(b.time);

    const aMoves =
      a.moves ?? Number.MAX_SAFE_INTEGER;

    const bMoves =
      b.moves ?? Number.MAX_SAFE_INTEGER;

    if (sortBy === "moves") {
      if (aMoves !== bMoves) {
        return aMoves - bMoves;
      }

      // Em caso de empate nos movimentos,
      // o menor tempo fica primeiro.
      return aTime - bTime;
    }

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    // Em caso de empate no tempo,
    // quem fez menos movimentos fica primeiro.
    return aMoves - bMoves;
  });
}

function filterRanking(
  entries: RankingEntry[],
  { pieces, mode }: GetRankingOptions,
): RankingEntry[] {
  return entries.filter(
    (entry) =>
      (pieces === undefined ||
        entry.pieces === pieces) &&
      (mode === undefined ||
        (entry.mode ?? "digital") === mode),
  );
}

// ==========================================
// ARMAZENAMENTO LOCAL
// ==========================================

function readLocalRanking(): RankingEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw =
    window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const ranking =
      JSON.parse(raw) as RankingEntry[];

    // Remove resultados antigos
    // gerados automaticamente.
    const manualRanking = ranking.filter(
      (entry) => !entry.autoSolved,
    );

    // Atualiza o localStorage caso ainda
    // existam resultados automáticos antigos.
    if (
      manualRanking.length !==
      ranking.length
    ) {
      writeLocalRanking(manualRanking);
    }

    return manualRanking;
  } catch {
    return [];
  }
}

function writeLocalRanking(
  entries: RankingEntry[],
): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(entries),
  );
}

// ==========================================
// BACKEND
// ==========================================

async function requestApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${RANKING_API_URL}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Falha ao acessar o ranking (${response.status}).`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ==========================================
// API PÚBLICA
// ==========================================

export async function getRanking(
  options: GetRankingOptions = {},
): Promise<RankingEntry[]> {
  const { sortBy = "time" } = options;

  if (RANKING_API_URL) {
    const params = new URLSearchParams({
      sortBy,
    });

    if (options.pieces !== undefined) {
      params.set(
        "pieces",
        String(options.pieces),
      );
    }

    if (options.mode) {
      params.set("mode", options.mode);
    }

    const entries = await requestApi<
      RankingEntry[]
    >(`/ranking?${params.toString()}`);

    // Reaplica filtro e ordenação para
    // garantir o mesmo resultado do modo local.
    return sortRanking(
      filterRanking(entries, options),
      sortBy,
    );
  }

  return sortRanking(
    filterRanking(
      readLocalRanking(),
      options,
    ),
    sortBy,
  );
}

export async function saveRankingEntry(
  entry: NewRankingEntry,
): Promise<RankingEntry | null> {
  // Segurança extra:
  // soluções automáticas nunca entram
  // no ranking.
  if (entry.autoSolved) {
    return null;
  }

  if (RANKING_API_URL) {
    return requestApi<RankingEntry>(
      "/ranking",
      {
        method: "POST",
        body: JSON.stringify(entry),
      },
    );
  }

  const newEntry: RankingEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };

  writeLocalRanking([
    ...readLocalRanking(),
    newEntry,
  ]);

  return newEntry;
}

export async function clearRanking(): Promise<void> {
  if (RANKING_API_URL) {
    await requestApi<void>("/ranking", {
      method: "DELETE",
    });

    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(
    STORAGE_KEY,
  );
}

// ==========================================
// HISTÓRICO DA PARTIDA
// ==========================================

// Monta a lista de passos seguindo a ordem
// de colocação. Peças que não estão no
// tabuleiro são ignoradas.
export function buildPlacementSteps(
  pieces: PlacedPiece[],
  placementOrder: string[],
): PlacementStep[] {
  const byId = new Map(
    pieces.map((piece) => [
      piece.instanceId,
      piece,
    ]),
  );

  return placementOrder
    .map((instanceId) => byId.get(instanceId))
    .filter(
      (piece): piece is PlacedPiece & {
        origin: Cell;
      } => !!piece?.origin,
    )
    .map((piece, index) => ({
      order: index + 1,
      shapeId: piece.shapeId,
      rotation: piece.rotation,
      origin: piece.origin,
    }));
}

export function buildFinalBoard(
  config: BoardConfig,
  steps: PlacementStep[],
): FinalBoard {
  const board: FinalBoard = Array.from(
    { length: config.rows },
    () =>
      Array.from<PentominoId | null>({
        length: config.cols,
      }).fill(null),
  );

  steps.forEach((step) => {
    const shape = PENTOMINOES.find(
      (pentomino) =>
        pentomino.id === step.shapeId,
    );

    if (!shape) {
      return;
    }

    getPieceCells(
      shape,
      step.rotation,
      step.origin,
    ).forEach(([row, col]) => {
      if (board[row]?.[col] !== undefined) {
        board[row][col] = step.shapeId;
      }
    });
  });

  return board;
}

// ==========================================
// FORMATAÇÃO
// ==========================================

export function formatElapsedTime(
  totalSeconds: number,
): string {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds),
  );

  const minutes = String(
    Math.floor(safeSeconds / 60),
  ).padStart(2, "0");

  const seconds = String(
    safeSeconds % 60,
  ).padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function formatToday(): string {
  const now = new Date();

  const day = String(
    now.getDate(),
  ).padStart(2, "0");

  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");

  return `${day}/${month}`;
}

export interface FinishGameParams {
  player: string;
  pieces: number;
  moves: number;
  elapsedSeconds: number;
  mode: GameMode;
  placements: PlacementStep[];
  finalBoard: FinalBoard;
}

export function finishGame({
  player,
  pieces,
  moves,
  elapsedSeconds,
  mode,
  placements,
  finalBoard,
}: FinishGameParams): Promise<RankingEntry | null> {
  return saveRankingEntry({
    player:
      player.trim() || "Jogador",
    time: formatElapsedTime(
      elapsedSeconds,
    ),
    pieces,
    moves,
    date: formatToday(),
    mode,
    placements,
    finalBoard,
  });
}
