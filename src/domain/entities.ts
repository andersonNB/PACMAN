import type {
  CollectibleKind,
  Direction,
  EnemyBehaviorMode,
  EnemyNavigationState,
  GameStatus,
  LivesValue,
  ScoreValue,
  TileKind,
  TilePosition,
  Velocity,
  WorldPosition
} from "./value-objects.js";

export type BoardTile = Readonly<{
  position: TilePosition;
  kind: TileKind;
  marker: "." | "o" | null;
}>;

export type Collectible = Readonly<{
  id: string;
  kind: CollectibleKind;
  tile: TilePosition;
  points: number;
  active: boolean;
}>;

export type Player = Readonly<{
  id: "player";
  position: WorldPosition;
  currentDirection: Direction;
  requestedDirection: Direction | null;
  velocity: Velocity;
}>;

export type Enemy = Readonly<{
  id: string;
  position: WorldPosition;
  currentDirection: Direction;
  velocity: Velocity;
  behaviorMode: EnemyBehaviorMode;
  navigationState: EnemyNavigationState;
  strategyId: string;
  homeTile: TilePosition;
  scatterTargetTile: TilePosition;
}>;

export type Board = Readonly<{
  width: number;
  height: number;
  tiles: readonly BoardTile[];
  playerSpawn: TilePosition;
  enemySpawns: readonly TilePosition[];
}>;

export type SessionConfigState = Readonly<{
  initialLives: number;
  playerSpeedUnitsPerSecond: number;
  enemySpeedUnitsPerSecond: number;
  frightenedDurationMs: number;
  scoring: Readonly<{
    dotPoints: number;
    powerPelletPoints: number;
    enemyPoints: number;
  }>;
  respawnDelayMs: number;
  levelCompletedDelayMs: number;
}>;

export type GameState = Readonly<{
  board: Board;
  player: Player;
  enemies: readonly Enemy[];
  collectibles: readonly Collectible[];
  score: ScoreValue;
  lives: LivesValue;
  status: GameStatus;
  tick: number;
  phaseTimerMs: number | null;
  frightenedTimerMs: number | null;
  frightenedChainCount: number;
  sessionConfig: SessionConfigState;
}>;
