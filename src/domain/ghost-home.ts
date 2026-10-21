import { createBoardQuery } from "./board.js";
import type { Board } from "./entities.js";
import type { TilePosition } from "./value-objects.js";

/** Finds the first player-walkable tile vertically above a ghost's home. */
export const findGhostHomeExit = (board: Board, homeTile: TilePosition): TilePosition | null => {
  const boardQuery = createBoardQuery(board);

  for (let row = homeTile.row - 1; row >= 0; row -= 1) {
    const candidate = { row, column: homeTile.column };

    if (boardQuery.isWalkable(candidate)) {
      return candidate;
    }
  }

  return null;
};
