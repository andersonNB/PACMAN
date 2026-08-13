import type { Board, Player } from "./entities.js";
import {
  createBoardQuery,
  createTilePosition
} from "./board.js";
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

export type AdvancePlayerParams = Readonly<{
  board: Board;
  player: Player;
  deltaMs: number;
}>;

export const createPlayer = (params: {
  spawnTile: TilePosition;
  initialDirection?: Direction;
  velocity: Velocity;
}): Player => ({
  id: "player",
  position: tileToWorldPosition(params.spawnTile),
  currentDirection: params.initialDirection ?? "left",
  requestedDirection: null,
  velocity: params.velocity
});

export const requestPlayerDirection = (player: Player, direction: Direction): Player => ({
  ...player,
  requestedDirection: direction
});

export const advancePlayer = ({ board, player, deltaMs }: AdvancePlayerParams): Player => {
  if (deltaMs <= 0) {
    return player;
  }

  let remainingDistance = player.velocity.unitsPerSecond * (deltaMs / 1000);
  let nextPlayer = player;

  while (remainingDistance > POSITION_EPSILON) {
    const currentTile = worldToTilePosition(nextPlayer.position);

    if (isAtTileCenter(nextPlayer.position)) {
      nextPlayer = resolveDirectionAtCenter(nextPlayer, currentTile, board);
    }

    const activeDirection = nextPlayer.currentDirection;
    const boardQuery = createBoardQuery(board);

    if (!boardQuery.getAllowedDirectionsForPlayer(currentTile).includes(activeDirection)) {
      break;
    }

    const distanceToBoundary = distanceToNextTileCenter(nextPlayer.position, activeDirection);
    const stepDistance = Math.min(remainingDistance, distanceToBoundary);
    const movedPosition = movePosition(nextPlayer.position, activeDirection, stepDistance);
    const normalizedPosition = normalizeWorldPosition(movedPosition, board);

    nextPlayer = {
      ...nextPlayer,
      position: normalizeNearCenter(normalizedPosition)
    };

    remainingDistance -= stepDistance;

    if (stepDistance <= POSITION_EPSILON) {
      break;
    }

    if (remainingDistance <= POSITION_EPSILON && isAtTileCenter(nextPlayer.position)) {
      nextPlayer = resolveDirectionAtCenter(nextPlayer, worldToTilePosition(nextPlayer.position), board);
    }
  }

  return nextPlayer;
};

export const tileToWorldPosition = (tile: TilePosition): WorldPosition => ({
  x: tile.column + HALF_TILE,
  y: tile.row + HALF_TILE
});

export const worldToTilePosition = (position: WorldPosition): TilePosition =>
  createTilePosition(Math.floor(position.y), Math.floor(position.x));

export const isAtTileCenter = (position: WorldPosition): boolean =>
  isCenteredCoordinate(position.x) && isCenteredCoordinate(position.y);

const isCenteredCoordinate = (coordinate: number): boolean =>
  Math.abs((coordinate % 1) - HALF_TILE) <= POSITION_EPSILON;

const resolveDirectionAtCenter = (player: Player, currentTile: TilePosition, board: Board): Player => {
  const boardQuery = createBoardQuery(board);
  const availableDirections = boardQuery.getAllowedDirectionsForPlayer(currentTile);
  const requestedDirection = player.requestedDirection;

  if (requestedDirection !== null && availableDirections.includes(requestedDirection)) {
    return {
      ...player,
      currentDirection: requestedDirection
    };
  }

  if (availableDirections.includes(player.currentDirection)) {
    return player;
  }

  return player;
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

const nextHalfStep = (coordinate: number): number => Math.floor(coordinate + HALF_TILE) + HALF_TILE;

const previousHalfStep = (coordinate: number): number => Math.ceil(coordinate - HALF_TILE) - HALF_TILE;

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

export const getOppositeDirection = (direction: Direction): Direction => OPPOSITE_DIRECTION[direction];
