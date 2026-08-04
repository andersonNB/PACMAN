import { describe, expect, it } from "vitest";
import type { ScoreEntry } from "../application/ports.js";
import {
  createBrowserStorageScoreRepository,
  createInMemoryScoreRepository
} from "./score-repositories.js";

describe("createInMemoryScoreRepository", () => {
  it("returns entries sorted by score descending", async () => {
    const repository = createInMemoryScoreRepository([
      createEntry("Blinky", 1200, "2026-08-03T10:30:00.000Z"),
      createEntry("Pinky", 980, "2026-08-03T10:35:00.000Z")
    ]);

    await repository.save(createEntry("Inky", 1500, "2026-08-03T10:40:00.000Z"));

    await expect(repository.listTop(2)).resolves.toEqual([
      createEntry("Inky", 1500, "2026-08-03T10:40:00.000Z"),
      createEntry("Blinky", 1200, "2026-08-03T10:30:00.000Z")
    ]);
  });
});

describe("createBrowserStorageScoreRepository", () => {
  it("persists entries and reads back the highest scores", async () => {
    const storage = createStorageDouble();
    const repository = createBrowserStorageScoreRepository(storage, "pacman-test-scores");

    await repository.save(createEntry("Player 1", 400, "2026-08-03T10:00:00.000Z"));
    await repository.save(createEntry("Player 2", 900, "2026-08-03T11:00:00.000Z"));
    await repository.save(createEntry("Player 3", 700, "2026-08-03T12:00:00.000Z"));

    await expect(repository.listTop(2)).resolves.toEqual([
      createEntry("Player 2", 900, "2026-08-03T11:00:00.000Z"),
      createEntry("Player 3", 700, "2026-08-03T12:00:00.000Z")
    ]);
  });

  it("ignores invalid persisted payloads", async () => {
    const storage = createStorageDouble({
      "pacman-test-scores": "{not-valid-json"
    });
    const repository = createBrowserStorageScoreRepository(storage, "pacman-test-scores");

    await expect(repository.listTop(5)).resolves.toEqual([]);
  });
});

const createEntry = (
  playerName: string,
  score: number,
  achievedAtIso: string
): ScoreEntry => ({
  playerName,
  score,
  achievedAtIso
});

const createStorageDouble = (seed: Record<string, string> = {}): Pick<Storage, "getItem" | "setItem"> => {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    }
  };
};
