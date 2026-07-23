export const DIRECTIONS = ["up", "down", "left", "right"] as const;

export type Direction = (typeof DIRECTIONS)[number];

export type TilePosition = Readonly<{
  row: number;
  column: number;
}>;

export type WorldPosition = Readonly<{
  x: number;
  y: number;
}>;

export type Velocity = Readonly<{
  unitsPerSecond: number;
}>;

export type DurationMs = Readonly<{
  value: number;
}>;

export type ScoreValue = Readonly<{
  value: number;
}>;

export type LivesValue = Readonly<{
  value: number;
}>;

export type GameStatus =
  | "idle"
  | "running"
  | "paused"
  | "playerDying"
  | "levelCompleted"
  | "gameOver"
  | "victory";

export type EnemyBehaviorMode = "scatter" | "chase" | "frightened";

export type EnemyNavigationState =
  | "insideHome"
  | "leavingHome"
  | "outside"
  | "eaten"
  | "returningHome"
  | "enteringHome";

export type CollectibleKind = "dot" | "powerPellet";

export type TileKind =
  | "wall"
  | "path"
  | "tunnel"
  | "ghostHouse"
  | "restricted";
