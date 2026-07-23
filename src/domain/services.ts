import type { Enemy } from "./entities.js";
import type { Direction, TilePosition, WorldPosition } from "./value-objects.js";

export type MovementRules = Readonly<{
  canEnterTile: (tile: TilePosition) => boolean;
  allowedDirectionsFrom: (tile: TilePosition) => readonly Direction[];
}>;

export type CollisionResult = Readonly<{
  collectedIds: readonly string[];
  enemyIds: readonly string[];
  crossedEnemyIds: readonly string[];
}>;

export type CollisionDetector = Readonly<{
  detect: (params: {
    previousPlayerPosition: WorldPosition;
    currentPlayerPosition: WorldPosition;
    enemies: readonly Enemy[];
  }) => CollisionResult;
}>;

export type EnemyDecisionContext = Readonly<{
  selfId: string;
  currentTile: TilePosition;
  currentDirection: Direction;
  availableDirections: readonly Direction[];
  playerTile: TilePosition;
  homeTile: TilePosition;
  scatterTargetTile: TilePosition;
}>;

export type EnemyMovementStrategy = Readonly<{
  id: string;
  chooseDirection: (context: EnemyDecisionContext) => Direction;
}>;
