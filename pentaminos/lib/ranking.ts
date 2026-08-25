export interface RankingEntry {
  id: string;
  player: string;
  time: string;
  pieces: number;
  date: string;
  autoSolved?: boolean;
}

const STORAGE_KEY = "pentaminos:ranking";

const DEFAULT_RANKING: RankingEntry[] = [
  { id: "1", player: "Rafael M.", time: "00:47", pieces: 4, date: "10/08" },
  { id: "2", player: "Camila S.", time: "01:23", pieces: 5, date: "11/08" },
  { id: "3", player: "João P.", time: "01:58", pieces: 6, date: "09/08" },
  { id: "4", player: "Beatriz L.", time: "02:34", pieces: 7, date: "12/08" },
  { id: "5", player: "Lucas A.", time: "03:21", pieces: 8, date: "08/08" },
  { id: "6", player: "Fernanda R.", time: "04:03", pieces: 9, date: "13/08" },
  { id: "7", player: "André T.", time: "05:12", pieces: 10, date: "07/08" },
  { id: "8", player: "Mariana C.", time: "06:29", pieces: 11, date: "14/08", autoSolved: true },
  { id: "9", player: "Gabriel F.", time: "07:47", pieces: 12, date: "06/08" },
];

function timeToSeconds(time: string) {
  const [minutes, seconds] = time.split(":").map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
}

function sortRanking(entries: RankingEntry[]) {
  return [...entries].sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time));
}

export function getRanking(): RankingEntry[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_RANKING));
    return sortRanking(DEFAULT_RANKING);
  }

  try {
    return sortRanking(JSON.parse(raw) as RankingEntry[]);
  } catch {
    return sortRanking(DEFAULT_RANKING);
  }
}

export function saveRankingEntry(entry: Omit<RankingEntry, "id">): RankingEntry[] {
  const updated = sortRanking([
    ...getRanking(),
    { ...entry, id: crypto.randomUUID() },
  ]);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearRanking(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}