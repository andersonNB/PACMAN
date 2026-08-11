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
  navigationState?: Enemy["navigationState"];
}): Enemy => ({
  id: params.id,
  position: tileToWorldPosition(params.spawnTile),
  currentDirection: params.initialDirection ?? "left",
  velocity: params.velocity,
  behaviorMode: params.behaviorMode ?? "scatter",
  navigationState: params.navigationState ?? "outside",
  strategyId: params.strategyId,
  homeTile: params.spawnTile,
  scatterTargetTile: params.scatterTargetTile
});

export const getDefaultEnemyBehaviorMode = (enemy: Pick<Enemy, "strategyId">): Enemy["behaviorMode"] =>
  enemy.strategyId === "chase" ? "chase" : "scatter";

export const createEnemies = (board: Board, velocity: Velocity): readonly Enemy[] =>
  board.enemySpawns.map((spawnTile, index) => {
    const strategyId = index === 0 ? "chase" : index === 1 ? "patrol" : "random";
    const scatterTargetTile =
      index % 2 === 0
        ? { row: 1, column: board.width - 2 }
        : { row: board.height - 2, column: board.width - 2 };

    return createEnemy({
      id: `enemy-${index + 1}`,
      spawnTile,
      velocity,
      strategyId,
      behaviorMode: getDefaultEnemyBehaviorMode({ strategyId }),
      scatterTargetTile,
      initialDirection: index % 2 === 0 ? "left" : "right",
      navigationState: index === 0 ? "outside" : "insideHome"
    });
  });

export const setEnemyBehaviorMode = (enemy: Enemy, behaviorMode: Enemy["behaviorMode"]): Enemy => ({
  ...enemy,
  behaviorMode
});

export const setEnemyNavigationState = (
  enemy: Enemy,
  navigationState: Enemy["navigationState"]
): Enemy => ({
  ...enemy,
  navigationState
});

export const releaseEnemyFromHome = (enemy: Enemy): Enemy => ({
  ...enemy,
  currentDirection: "up",
  navigationState: "leavingHome"
});

export const markEnemyAsReturningHome = (enemy: Enemy): Enemy => ({
  ...enemy,
  behaviorMode: getDefaultEnemyBehaviorMode(enemy),
  navigationState: "returningHome"
});

export const resetEnemyToHome = (enemy: Enemy): Enemy => ({
  ...enemy,
  position: tileToWorldPosition(enemy.homeTile),
  currentDirection: "left",
  behaviorMode: getDefaultEnemyBehaviorMode(enemy),
  navigationState: "outside"
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

  if (deltaMs <= 0 || enemy.navigationState === "insideHome") {
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

    if (enemy.navigationState === "leavingHome" && reachedHomeExit(enemy, board)) {
      enemy = {
        ...enemy,
        navigationState: "outside"
      };
    }

    if (enemy.navigationState === "returningHome" && isAtTileCenter(enemy.position) && sameTile(worldToTilePosition(enemy.position), enemy.homeTile)) {
      enemy = resetEnemyToHome(enemy);
    }

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
  const chosenDirection = enemy.navigationState === "returningHome"
    ? chooseDirectionByTarget(candidateDirections, currentTile, enemy.homeTile, "nearest") ?? enemy.currentDirection
    : enemy.navigationState === "leavingHome"
      ? chooseDirectionByTarget(candidateDirections, currentTile, getHomeExitTargetTile(board, enemy.homeTile), "nearest") ?? enemy.currentDirection
      : enemy.behaviorMode === "scatter"
        ? chooseDirectionByTarget(candidateDirections, currentTile, enemy.scatterTargetTile, "nearest") ?? enemy.currentDirection
        : (
            enemy.behaviorMode === "frightened"
              ? enemyStrategies.flee
              : enemyStrategies[enemy.strategyId]
          )?.chooseDirection({
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

const reachedHomeExit = (enemy: Enemy, board: Board): boolean =>
  isAtTileCenter(enemy.position) &&
  sameTile(worldToTilePosition(enemy.position), getHomeExitTargetTile(board, enemy.homeTile));

const getHomeExitTargetTile = (board: Board, homeTile: TilePosition): TilePosition => {
  const boardQuery = createBoardQuery(board);

  for (let row = homeTile.row - 1; row >= 0; row -= 1) {
    const candidate = { row, column: homeTile.column };

    if (boardQuery.isWalkable(candidate)) {
      return candidate;
    }
  }

  return homeTile;
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

export const createDeterministicRandom = (values: readonly number[]): RandomNumberSource => {
  let index = 0;

  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
};
