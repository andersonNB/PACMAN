import type { BoardQuery } from "./board.js";
import type { Direction, EnemyNavigationState, TilePosition } from "./value-objects.js";

const VECTORS: Readonly<Record<Direction, TilePosition>> = {
  up: { row: -1, column: 0 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
  right: { row: 0, column: 1 }
};

const positionKey = (tile: TilePosition): string => `${tile.row}:${tile.column}`;

export const chooseShortestEnemyDirection = (
  query: BoardQuery,
  origin: TilePosition,
  target: TilePosition,
  navigationState: EnemyNavigationState
): Direction | null => {
  const targetKey = positionKey(target);
  if (positionKey(origin) === targetKey ||
    !query.isWalkableForEnemy(origin, navigationState) ||
    !query.isWalkableForEnemy(target, navigationState)) {
    return null;
  }

  const queue: { tile: TilePosition; firstDirection: Direction | null }[] = [
    { tile: origin, firstDirection: null }
  ];
  const visited = new Set([positionKey(origin)]);

  // Equal-cost edges make BFS sufficient; direction order resolves ties deterministically.
  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index];
    if (node === undefined) {
      continue;
    }

    for (const direction of query.getAllowedDirectionsForEnemy(node.tile, navigationState)) {
      const vector = VECTORS[direction];
      const tile = query.normalizeTunnelExit({
        row: node.tile.row + vector.row,
        column: node.tile.column + vector.column
      });
      const key = positionKey(tile);
      if (visited.has(key)) {
        continue;
      }

      const firstDirection = node.firstDirection ?? direction;
      if (key === targetKey) {
        return firstDirection;
      }

      visited.add(key);
      queue.push({ tile, firstDirection });
    }
  }

  return null;
};
