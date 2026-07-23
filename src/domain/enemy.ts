import type { Board, Enemy } from "./entities.js";
import { createBoardQuery } from "./board.js";
import { enemyStrategies } from "./enemy-strategies.js";
import { tileToWorldPosition, worldToTilePosition } from "./player.js";
import type { Direction, TilePosition, Velocity, WorldPosition } from "./value-objects.js";

const HALF_TILE = 0.5;
const POSITION_EPSILON = 0.00001;

const DIRECTION_VECTORS: Readonly<Record<Direction, Readonly<{ x: number; y: number }>>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const OPPOSITE_DIRECTION: Readonly<Record<Direction, Direction>> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};

export type RandomNumberSource = () => number;

export const createEnemy = (params: {
  id: string;
  spawnTile: TilePosition;
  velocity: Velocity;
  strategyId: string;
  behaviorMode?: Enemy["behaviorMode"];
  scatterTargetTile: TilePosition;
  initialDirection?: Direction;
}): Enemy => ({
  id: params.id,
  position: tileToWorldPosition(params.spawnTile),
  currentDirection: params.initialDirection ?? "left",
  velocity: params.velocity,
  behaviorMode: params.behaviorMode ?? "scatter",
  navigationState: "outside",
  strategyId: params.strategyId,
  homeTile: params.spawnTile,
  scatterTargetTile: params.scatterTargetTile
});

export const createEnemies = (board: Board, velocity: Velocity): readonly Enemy[] =>
  board.enemySpawns.map((spawnTile, index) => {
    const strategyId = index === 0 ? "chase" : index === 1 ? "patrol" : "random";
    const behaviorMode = strategyId === "chase" ? "chase" : "scatter";
    const scatterTargetTile =
      index % 2 === 0
        ? { row: 1, column: board.width - 2 }
        : { row: board.height - 2, column: board.width - 2 };

    return createEnemy({
      id: `enemy-${index + 1}`,
      spawnTile,
      velocity,
      strategyId,
      behaviorMode,
      scatterTargetTile,
      initialDirection: index % 2 === 0 ? "left" : "right"
    });
  });

export const advanceEnemy = (params: {
  board: Board;
  enemy: Enemy;
  playerPosition: WorldPosition;
  deltaMs: number;
  nextRandom: RandomNumberSource;
}): Enemy => {
  const { board, deltaMs, nextRandom, playerPosition } = params;
  let enemy = params.enemy;

  if (deltaMs <= 0) {
    return enemy;
  }

  let remainingDistance = enemy.velocity.unitsPerSecond * (deltaMs / 1000);

  while (remainingDistance > POSITION_EPSILON) {
    const currentTile = worldToTilePosition(enemy.position);

    if (isAtTileCenter(enemy.position)) {
      enemy = resolveEnemyDirectionAtCenter(enemy, currentTile, worldToTilePosition(playerPosition), board, nextRandom);
    }

    const boardQuery = createBoardQuery(board);
    const activeDirection = enemy.currentDirection;

    if (!boardQuery.getAllowedDirections(currentTile).includes(activeDirection)) {
      break;
    }

    const distanceToBoundary = distanceToNextTileCenter(enemy.position, activeDirection);
    const stepDistance = Math.min(remainingDistance, distanceToBoundary);

    enemy = {
      ...enemy,
      position: normalizeNearCenter(
        normalizeWorldPosition(movePosition(enemy.position, activeDirection, stepDistance), board)
      )
    };

    remainingDistance -= stepDistance;

    if (stepDistance <= POSITION_EPSILON) {
      break;
    }
  }

  return enemy;
};

export const detectEnemyCollision = (params: {
  playerPosition: WorldPosition;
  previousPlayerPosition: WorldPosition;
  enemy: Enemy;
  previousEnemyPosition: WorldPosition;
}): boolean => {
  const currentPlayerTile = worldToTilePosition(params.playerPosition);
  const currentEnemyTile = worldToTilePosition(params.enemy.position);

  if (sameTile(currentPlayerTile, currentEnemyTile)) {
    return true;
  }

  const previousPlayerTile = worldToTilePosition(params.previousPlayerPosition);
  const previousEnemyTile = worldToTilePosition(params.previousEnemyPosition);

  return sameTile(previousPlayerTile, currentEnemyTile) && sameTile(previousEnemyTile, currentPlayerTile);
};

const resolveEnemyDirectionAtCenter = (
  enemy: Enemy,
  currentTile: TilePosition,
  playerTile: TilePosition,
  board: Board,
  nextRandom: RandomNumberSource
): Enemy => {
  const boardQuery = createBoardQuery(board);
  const availableDirections = boardQuery.getAllowedDirections(currentTile);

  if (availableDirections.length === 0) {
    return enemy;
  }

  const nonReverseDirections = availableDirections.filter(
    (direction) => direction !== OPPOSITE_DIRECTION[enemy.currentDirection]
  );

  const candidateDirections =
    nonReverseDirections.length > 0 ? nonReverseDirections : availableDirections;

  const randomValue = nextRandom();
  const strategy = enemy.behaviorMode === "frightened" ? enemyStrategies.flee : enemyStrategies[enemy.strategyId];
  const chosenDirection =
    strategy?.chooseDirection({
      selfId: enemy.id,
      currentTile,
      currentDirection: enemy.currentDirection,
      availableDirections: candidateDirections,
      playerTile,
      homeTile: enemy.homeTile,
      scatterTargetTile: enemy.scatterTargetTile,
      randomValue
    }) ?? enemy.currentDirection;

  return {
    ...enemy,
    currentDirection: candidateDirections.includes(chosenDirection) ? chosenDirection : enemy.currentDirection
  };
};

const distanceToNextTileCenter = (position: WorldPosition, direction: Direction): number => {
  const vector = DIRECTION_VECTORS[direction];

  if (vector.x > 0) {
    return nextHalfStep(position.x) - position.x;
  }

  if (vector.x < 0) {
    return position.x - previousHalfStep(position.x);
  }

  if (vector.y > 0) {
    return nextHalfStep(position.y) - position.y;
  }

  return position.y - previousHalfStep(position.y);
};

const movePosition = (position: WorldPosition, direction: Direction, distance: number): WorldPosition => {
  const vector = DIRECTION_VECTORS[direction];

  return {
    x: position.x + vector.x * distance,
    y: position.y + vector.y * distance
  };
};

const normalizeWorldPosition = (position: WorldPosition, board: Board): WorldPosition => {
  if (position.x < 0) {
    return {
      x: board.width + position.x,
      y: position.y
    };
  }

  if (position.x >= board.width) {
    return {
      x: position.x - board.width,
      y: position.y
    };
  }

  return position;
};

const normalizeNearCenter = (position: WorldPosition): WorldPosition => ({
  x: roundIfNearHalf(position.x),
  y: roundIfNearHalf(position.y)
});

const roundIfNearHalf = (value: number): number => {
  const nearestHalf = Math.round((value - HALF_TILE) * 2) / 2 + HALF_TILE;

  if (Math.abs(value - nearestHalf) <= POSITION_EPSILON) {
    return nearestHalf;
  }

  return value;
};

const isAtTileCenter = (position: WorldPosition): boolean =>
  isCenteredCoordinate(position.x) && isCenteredCoordinate(position.y);

const isCenteredCoordinate = (coordinate: number): boolean =>
  Math.abs((coordinate % 1) - HALF_TILE) <= POSITION_EPSILON;

const nextHalfStep = (coordinate: number): number => Math.floor(coordinate + HALF_TILE) + HALF_TILE;

const previousHalfStep = (coordinate: number): number => Math.ceil(coordinate - HALF_TILE) - HALF_TILE;

const sameTile = (left: TilePosition, right: TilePosition): boolean =>
  left.row === right.row && left.column === right.column;

export const createDeterministicRandom = (values: readonly number[]): RandomNumberSource => {
  let index = 0;

  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
};
