import type { EnemyDecisionContext, EnemyMovementStrategy } from "./services.js";
import type { Direction, TilePosition } from "./value-objects.js";

export const randomMovementStrategy: EnemyMovementStrategy = {
  id: "random",
  chooseDirection: (context) => {
    const directionIndex = Math.min(
      context.availableDirections.length - 1,
      Math.floor(context.randomValue * context.availableDirections.length)
    );

    return context.availableDirections[directionIndex] ?? context.currentDirection;
  }
};

export const chasePlayerStrategy: EnemyMovementStrategy = {
  id: "chase",
  chooseDirection: (context) =>
    chooseDirectionByTarget(context.availableDirections, context.currentTile, context.playerTile, "nearest") ??
    context.currentDirection
};

export const patrolStrategy: EnemyMovementStrategy = {
  id: "patrol",
  chooseDirection: (context) =>
    chooseDirectionByTarget(context.availableDirections, context.currentTile, context.scatterTargetTile, "nearest") ??
    context.currentDirection
};

export const fleeStrategy: EnemyMovementStrategy = {
  id: "flee",
  chooseDirection: (context) =>
    chooseDirectionByTarget(context.availableDirections, context.currentTile, context.playerTile, "farthest") ??
    context.currentDirection
};

export const enemyStrategies: Readonly<Record<string, EnemyMovementStrategy>> = {
  random: randomMovementStrategy,
  chase: chasePlayerStrategy,
  patrol: patrolStrategy,
  flee: fleeStrategy
};

const chooseDirectionByTarget = (
  directions: readonly Direction[],
  origin: TilePosition,
  target: TilePosition,
  preference: "nearest" | "farthest"
): Direction | null => {
  let selectedDirection: Direction | null = null;
  let selectedDistance = preference === "nearest" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  directions.forEach((direction) => {
    const nextTile = moveTile(origin, direction);
    const distance = manhattanDistance(nextTile, target);

    if (preference === "nearest" && distance < selectedDistance) {
      selectedDistance = distance;
      selectedDirection = direction;
    }

    if (preference === "farthest" && distance > selectedDistance) {
      selectedDistance = distance;
      selectedDirection = direction;
    }
  });

  return selectedDirection;
};

const moveTile = (tile: TilePosition, direction: Direction): TilePosition => {
  if (direction === "up") {
    return { row: tile.row - 1, column: tile.column };
  }

  if (direction === "down") {
    return { row: tile.row + 1, column: tile.column };
  }

  if (direction === "left") {
    return { row: tile.row, column: tile.column - 1 };
  }

  return { row: tile.row, column: tile.column + 1 };
};

const manhattanDistance = (left: TilePosition, right: TilePosition): number =>
  Math.abs(left.row - right.row) + Math.abs(left.column - right.column);
