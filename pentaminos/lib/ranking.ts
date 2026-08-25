export interface RankingEntry {
  id: string;
  player: string;
  time: string;
  pieces: number;
  date: string;
  autoSolved?: boolean;
}

const STORAGE_KEY = "pentaminos:ranking";

function timeToSeconds(time: string): number {
  const [minutes, seconds] = time.split(":").map(Number);

  return (minutes || 0) * 60 + (seconds || 0);
}

function sortRanking(entries: RankingEntry[]): RankingEntry[] {
  return [...entries].sort(
    (a, b) => timeToSeconds(a.time) - timeToSeconds(b.time),
  );
}

export function getRanking(): RankingEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const ranking = JSON.parse(raw) as RankingEntry[];

    return sortRanking(ranking);
  } catch {
    return [];
  }
}

export function saveRankingEntry(
  entry: Omit<RankingEntry, "id">,
): RankingEntry[] {
  const currentRanking = getRanking();

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

  window.localStorage.removeItem(STORAGE_KEY);
}

export function formatElapsedTime(totalSeconds: number): string {
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

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}`;
}

export interface FinishGameParams {
  player: string;
  pieces: number;
  elapsedSeconds: number;
  autoSolved?: boolean;
}

export function finishGame({
  player,
  pieces,
  elapsedSeconds,
  autoSolved,
}: FinishGameParams): RankingEntry[] {
  return saveRankingEntry({
    player: player.trim() || "Jogador",
    time: formatElapsedTime(elapsedSeconds),
    pieces,
    date: formatToday(),
    autoSolved,
  });
}
