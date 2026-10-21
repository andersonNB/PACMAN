import { createBoardQuery } from "./board.js";
import type { Board } from "./entities.js";
import { findGhostHomeExit } from "./ghost-home.js";
import type { Direction, TilePosition } from "./value-objects.js";

export type LevelIssue = Readonly<{
  code: "noPellets" | "unreachableCollectible" | "disconnectedEnemySpawn" | "unreachableEnemyExit";
  tile: TilePosition | null;
}>;

export type LevelValidationReport = Readonly<{
  playable: boolean;
  issues: readonly LevelIssue[];
}>;

const VECTORS: Readonly<Record<Direction, TilePosition>> = {
  up: { row: -1, column: 0 }, down: { row: 1, column: 0 },
  left: { row: 0, column: -1 }, right: { row: 0, column: 1 }
};
const key = (tile: TilePosition): string => `${tile.row}:${tile.column}`;

export const validatePlayableBoard = (board: Board): LevelValidationReport => {
  const query = createBoardQuery(board);
  const reachable = (
    origin: TilePosition,
    getDirections: (tile: TilePosition) => readonly Direction[]
  ): ReadonlySet<string> => {
    const visited = new Set([key(origin)]);
    const queue = [origin];
    for (let index = 0; index < queue.length; index += 1) {
      const tile = queue[index];
      if (tile === undefined) continue;
      for (const direction of getDirections(tile)) {
        const vector = VECTORS[direction];
        const next = query.normalizeTunnelExit({
          row: tile.row + vector.row, column: tile.column + vector.column
        });
        if (!visited.has(key(next))) {
          visited.add(key(next));
          queue.push(next);
        }
      }
    }
    return visited;
  };

  const playerReachable = reachable(board.playerSpawn, query.getAllowedDirectionsForPlayer);
  const enemyReachable = reachable(
    board.playerSpawn,
    (tile) => query.getAllowedDirectionsForEnemy(tile, "returningHome")
  );
  const hasGhostHouse = board.tiles.some((tile) => tile.kind === "ghostHouse");
  const issues: LevelIssue[] = [];
  if (!board.tiles.some((tile) => tile.marker === "." || tile.marker === "o")) {
    issues.push({ code: "noPellets", tile: null });
  }
  for (const tile of board.tiles) {
    if (tile.marker !== null && !playerReachable.has(key(tile.position))) {
      issues.push({ code: "unreachableCollectible", tile: tile.position });
    }
  }
  for (const tile of board.enemySpawns) {
    if (!enemyReachable.has(key(tile))) {
      issues.push({ code: "disconnectedEnemySpawn", tile });
    }

    if (hasGhostHouse) {
      const exitTile = findGhostHomeExit(board, tile);
      const canLeaveHome = exitTile !== null && reachable(
        tile,
        (currentTile) => query.getAllowedDirectionsForEnemy(currentTile, "leavingHome")
      ).has(key(exitTile));
      const canReturnHome = exitTile !== null && reachable(
        exitTile,
        (currentTile) => query.getAllowedDirectionsForEnemy(currentTile, "returningHome")
      ).has(key(tile));

      if (!canLeaveHome || !canReturnHome) {
        issues.push({ code: "unreachableEnemyExit", tile });
      }
    }
  }
  return { playable: issues.length === 0, issues };
};
