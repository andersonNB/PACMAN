import type { Board } from "../domain/entities.js";
import type { GameEvent } from "../domain/events.js";

export type ScoreEntry = Readonly<{
  playerName: string;
  score: number;
  achievedAtIso: string;
}>;

export type ScoreRepository = Readonly<{
  save: (entry: ScoreEntry) => Promise<void>;
  listTop: (limit: number) => Promise<readonly ScoreEntry[]>;
}>;

export type LevelSource = Readonly<{
  loadInitialBoard: () => Promise<Board>;
}>;

export type ClockPort = Readonly<{
  nowMs: () => number;
}>;

export type RandomPort = Readonly<{
  next: () => number;
}>;

export type EventBusPort = Readonly<{
  publish: (event: GameEvent) => void;
}>;
