import type { Board, BoardTile } from "./entities.js";
import { DIRECTIONS, type Direction, type TileKind, type TilePosition } from "./value-objects.js";
import type { EnemyNavigationState } from "./value-objects.js";

export type LevelSymbol =
  | "#"
  | "."
  | "o"
  | "P"
  | "E"
  | "T"
  | "H"
  | "R"
  | " ";

export type LevelDefinition = Readonly<{
  id: string;
  rows: readonly string[];
}>;

const TILE_KIND_BY_SYMBOL: Readonly<Record<LevelSymbol, TileKind>> = {
  "#": "wall",
  ".": "path",
  o: "path",
  P: "path",
  E: "path",
  T: "tunnel",
  H: "ghostHouse",
  R: "restricted",
  " ": "path"
};

const DIRECTION_VECTORS: Readonly<Record<Direction, Readonly<{ rowDelta: number; columnDelta: number }>>> = {
  up: { rowDelta: -1, columnDelta: 0 },
  down: { rowDelta: 1, columnDelta: 0 },
  left: { rowDelta: 0, columnDelta: -1 },
  right: { rowDelta: 0, columnDelta: 1 }
};

export type BoardQuery = Readonly<{
  getTile: (position: TilePosition) => BoardTile | null;
  isWithinBounds: (position: TilePosition) => boolean;
  isWalkable: (position: TilePosition) => boolean;
  isWalkableForPlayer: (position: TilePosition) => boolean;
  isWalkableForEnemy: (position: TilePosition, navigationState: EnemyNavigationState) => boolean;
  getAllowedDirections: (position: TilePosition) => readonly Direction[];
  getAllowedDirectionsForPlayer: (position: TilePosition) => readonly Direction[];
  getAllowedDirectionsForEnemy: (position: TilePosition, navigationState: EnemyNavigationState) => readonly Direction[];
  isIntersection: (position: TilePosition) => boolean;
  normalizeTunnelExit: (position: TilePosition) => TilePosition;
}>;

export const createBoard = (level: LevelDefinition): Board => {
  validateLevelRows(level.rows);

  const height = level.rows.length;
  const width = level.rows[0]?.length ?? 0;
  const tiles: BoardTile[] = [];
  let playerSpawn: TilePosition | null = null;
  const enemySpawns: TilePosition[] = [];

  level.rows.forEach((row, rowIndex) => {
    row.split("").forEach((symbol, columnIndex) => {
      const parsedSymbol = parseLevelSymbol(symbol);
      const position = createTilePosition(rowIndex, columnIndex);

      if (parsedSymbol === "P") {
        playerSpawn = position;
      }

      if (parsedSymbol === "E") {
        enemySpawns.push(position);
      }

      tiles.push({
        position,
        kind: TILE_KIND_BY_SYMBOL[parsedSymbol],
        marker: parsedSymbol === "." || parsedSymbol === "o" ? parsedSymbol : null
      });
    });
  });

  if (playerSpawn === null) {
    throw new Error("Level must define exactly one player spawn.");
  }

  if (enemySpawns.length === 0) {
    throw new Error("Level must define at least one enemy spawn.");
  }

  return {
    width,
    height,
    tiles,
    playerSpawn,
    enemySpawns
  };
};

export const createBoardQuery = (board: Board): BoardQuery => {
  const tileIndex = new Map<string, BoardTile>();

  board.tiles.forEach((tile) => {
    tileIndex.set(toPositionKey(tile.position), tile);
  });

  const getTile = (position: TilePosition): BoardTile | null => tileIndex.get(toPositionKey(position)) ?? null;

  const isWithinBounds = (position: TilePosition): boolean =>
    position.row >= 0 &&
    position.row < board.height &&
    position.column >= 0 &&
    position.column < board.width;

  const normalizeTunnelExit = (position: TilePosition): TilePosition => {
    const wrappedColumn =
      position.column < 0
        ? board.width - 1
        : position.column >= board.width
          ? 0
          : position.column;

    return createTilePosition(position.row, wrappedColumn);
  };

  const isWalkableForPlayer = (position: TilePosition): boolean => {
    const normalizedPosition = normalizePositionForBoard(position, board);
    const tile = getTile(normalizedPosition);

    if (tile === null) {
      return false;
    }

    return tile.kind === "path" || tile.kind === "tunnel";
  };

  const isWalkableForEnemy = (position: TilePosition, navigationState: EnemyNavigationState): boolean => {
    const normalizedPosition = normalizePositionForBoard(position, board);
    const tile = getTile(normalizedPosition);

    if (tile === null) {
      return false;
    }

    if (tile.kind === "wall") {
      return false;
    }

    if (navigationState === "insideHome" || navigationState === "leavingHome" || navigationState === "returningHome") {
      return true;
    }

    return tile.kind === "path" || tile.kind === "tunnel";
  };

  const getAllowedDirectionsForPlayer = (position: TilePosition): readonly Direction[] => {
    const tile = getTile(position);

    if (tile === null || !isWalkableForPlayer(position)) {
      return [];
    }

    return DIRECTIONS.filter((direction) => {
      const vector = DIRECTION_VECTORS[direction];
      const nextPosition = normalizePositionForBoard(
        createTilePosition(position.row + vector.rowDelta, position.column + vector.columnDelta),
        board
      );

      return isWalkableForPlayer(nextPosition);
    });
  };

  const getAllowedDirectionsForEnemy = (
    position: TilePosition,
    navigationState: EnemyNavigationState
  ): readonly Direction[] => {
    const tile = getTile(position);

    if (tile === null || !isWalkableForEnemy(position, navigationState)) {
      return [];
    }

    return DIRECTIONS.filter((direction) => {
      const vector = DIRECTION_VECTORS[direction];
      const nextPosition = normalizePositionForBoard(
        createTilePosition(position.row + vector.rowDelta, position.column + vector.columnDelta),
        board
      );

      return isWalkableForEnemy(nextPosition, navigationState);
    });
  };

  const getAllowedDirections = (position: TilePosition): readonly Direction[] =>
    getAllowedDirectionsForPlayer(position);

  const isWalkable = (position: TilePosition): boolean => isWalkableForPlayer(position);

  const isIntersection = (position: TilePosition): boolean => getAllowedDirectionsForPlayer(position).length >= 3;

  return {
    getTile,
    isWithinBounds,
    isWalkable,
    isWalkableForPlayer,
    isWalkableForEnemy,
    getAllowedDirections,
    getAllowedDirectionsForPlayer,
    getAllowedDirectionsForEnemy,
    isIntersection,
    normalizeTunnelExit
  };
};

export const createTilePosition = (row: number, column: number): TilePosition => ({ row, column });

const normalizePositionForBoard = (position: TilePosition, board: Board): TilePosition => {
  const row = position.row;
  const column =
    position.column < 0
      ? board.width - 1
      : position.column >= board.width
        ? 0
        : position.column;

  return createTilePosition(row, column);
};

const validateLevelRows = (rows: readonly string[]): void => {
  if (rows.length === 0) {
    throw new Error("Level must contain at least one row.");
  }

  const width = rows[0]?.length ?? 0;

  if (width === 0) {
    throw new Error("Level rows cannot be empty.");
  }

  rows.forEach((row) => {
    if (row.length !== width) {
      throw new Error("Level rows must have the same width.");
    }
  });
};

const parseLevelSymbol = (symbol: string): LevelSymbol => {
  if (
    symbol === "#" ||
    symbol === "." ||
    symbol === "o" ||
    symbol === "P" ||
    symbol === "E" ||
    symbol === "T" ||
    symbol === "H" ||
    symbol === "R" ||
    symbol === " "
  ) {
    return symbol;
  }

  throw new Error(`Unsupported level symbol: ${symbol}`);
};

const toPositionKey = (position: TilePosition): string => `${position.row}:${position.column}`;
