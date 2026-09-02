export interface RankingEntry {
  id: string;
  player: string;
  time: string;
  pieces: number;
  moves?: number;
  date: string;
  autoSolved?: boolean;
}

export type RankingSort = "time" | "moves";

interface GetRankingOptions {
  pieces?: number;
  sortBy?: RankingSort;
}

const STORAGE_KEY = "pentaminos:ranking";

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

export function getRanking(
  options: GetRankingOptions = {},
): RankingEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const {
    pieces,
    sortBy = "time",
  } = options;

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
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(manualRanking),
      );
    }

    // Se uma quantidade de peças foi informada,
    // mostra somente aquela categoria.
    const filteredRanking =
      pieces === undefined
        ? manualRanking
        : manualRanking.filter(
            (entry) =>
              entry.pieces === pieces,
          );

    return sortRanking(
      filteredRanking,
      sortBy,
    );
  } catch {
    return [];
  }
}

export function saveRankingEntry(
  entry: Omit<RankingEntry, "id">,
): RankingEntry[] {
  const currentRanking = getRanking();

  // Segurança extra:
  // soluções automáticas nunca entram
  // no ranking.
  if (entry.autoSolved) {
    return currentRanking;
  }

  const newEntry: RankingEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };

  const updatedRanking = sortRanking([
    ...currentRanking,
    newEntry,
  ]);

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updatedRanking),
  );

  return updatedRanking;
}

export function clearRanking(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(
    STORAGE_KEY,
  );
}

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
}

export function finishGame({
  player,
  pieces,
  moves,
  elapsedSeconds,
}: FinishGameParams): RankingEntry[] {
  return saveRankingEntry({
    player:
      player.trim() || "Jogador",
    time: formatElapsedTime(
      elapsedSeconds,
    ),
    pieces,
    moves,
    date: formatToday(),
  });
}