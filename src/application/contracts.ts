import type { CollectibleKind, Direction, EnemyBehaviorMode, EnemyNavigationState, GameStatus, TilePosition, WorldPosition } from "../domain/value-objects.js";

export type GameConfig = Readonly<{
  fixedTickMs: number;
  initialLives: number;
  playerSpeedUnitsPerSecond: number;
  enemySpeedUnitsPerSecond: number;
  frightenedDurationMs: number;
  scoring: Readonly<{
    dot: number;
    powerPellet: number;
    enemy: number;
  }>;
}>;

export type PlayerSnapshot = Readonly<{
  position: WorldPosition;
  currentDirection: Direction;
  requestedDirection: Direction | null;
}>;

export type EnemySnapshot = Readonly<{
  id: string;
  position: WorldPosition;
  currentDirection: Direction;
  behaviorMode: EnemyBehaviorMode;
  navigationState: EnemyNavigationState;
}>;

export type CollectibleSnapshot = Readonly<{
  id: string;
  kind: CollectibleKind;
  tile: TilePosition;
  active: boolean;
}>;

export type GameSnapshot = Readonly<{
  status: GameStatus;
  tick: number;
  score: number;
  lives: number;
  player: PlayerSnapshot;
  enemies: readonly EnemySnapshot[];
  collectibles: readonly CollectibleSnapshot[];
}>;
