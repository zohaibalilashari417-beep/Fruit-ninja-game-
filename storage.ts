export type ScoreEntry = { score: number; level: number; best: number; date: number };

const KEY = "fruitfury.scores.v1";
const BEST_KEY = "fruitfury.best.v1";

function read(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.score === "number")
      .slice(0, 8)
      .map((e) => ({
        score: Math.max(0, Math.round(e.score)),
        level: Math.max(1, Math.round(e.level || 1)),
        best: Math.max(0, Math.round(e.best || 0)),
        date: Number(e.date) || Date.now(),
      }));
  } catch {
    return [];
  }
}

export const scoreStore = {
  all: read,
  best(): number {
    const list = read();
    return list.reduce((m, e) => Math.max(m, e.score), 0);
  },
  add(entry: ScoreEntry): { list: ScoreEntry[]; rank: number; isBest: boolean } {
    const prevBest = this.best();
    const list = [...read(), entry].sort((a, b) => b.score - a.score).slice(0, 8);
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      if (entry.score > prevBest) localStorage.setItem(BEST_KEY, String(entry.score));
    } catch {
      /* storage unavailable — keep in-memory only */
    }
    const rank = list.findIndex((e) => e.date === entry.date && e.score === entry.score);
    return { list, rank, isBest: entry.score > prevBest && entry.score > 0 };
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  },
};
