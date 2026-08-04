import type { ScoreEntry, ScoreRepository } from "../application/ports.js";

const DEFAULT_STORAGE_KEY = "pacman-architecture-practice.high-scores";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const createInMemoryScoreRepository = (
  seedEntries: readonly ScoreEntry[] = []
): ScoreRepository => {
  let entries = sortEntries(seedEntries);

  return {
    async save(entry) {
      entries = sortEntries([...entries, entry]);
    },
    async listTop(limit) {
      return entries.slice(0, limit);
    }
  };
};

export const createBrowserStorageScoreRepository = (
  storage: StorageLike,
  storageKey = DEFAULT_STORAGE_KEY
): ScoreRepository => ({
  async save(entry) {
    const entries = readEntries(storage, storageKey);
    const nextEntries = sortEntries([...entries, entry]);
    storage.setItem(storageKey, JSON.stringify(nextEntries));
  },
  async listTop(limit) {
    return readEntries(storage, storageKey).slice(0, limit);
  }
});

const readEntries = (storage: StorageLike, storageKey: string): readonly ScoreEntry[] => {
  const rawValue = storage.getItem(storageKey);

  if (rawValue === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    const entries = parsed.filter(isScoreEntry);
    return sortEntries(entries);
  } catch {
    return [];
  }
};

const isScoreEntry = (value: unknown): value is ScoreEntry => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.playerName === "string"
    && typeof candidate.score === "number"
    && typeof candidate.achievedAtIso === "string";
};

const sortEntries = (entries: readonly ScoreEntry[]): readonly ScoreEntry[] =>
  [...entries].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.achievedAtIso.localeCompare(right.achievedAtIso);
  });
