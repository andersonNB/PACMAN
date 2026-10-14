import { createBoardQuery } from "./board.js";
import type { Board } from "./entities.js";
import type { Direction, TilePosition } from "./value-objects.js";

export type LevelIssue = Readonly<{
  code: "noPellets" | "unreachableCollectible" | "disconnectedEnemySpawn";
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
  const reachable = (forEnemy: boolean): ReadonlySet<string> => {
    const visited = new Set([key(board.playerSpawn)]);
    const queue = [board.playerSpawn];
    for (let index = 0; index < queue.length; index += 1) {
      const tile = queue[index];
      if (tile === undefined) continue;
      const directions = forEnemy
        ? query.getAllowedDirectionsForEnemy(tile, "returningHome")
        : query.getAllowedDirectionsForPlayer(tile);
      for (const direction of directions) {
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

  const playerReachable = reachable(false);
  const enemyReachable = reachable(true);
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
  }
  return { playable: issues.length === 0, issues };
};
