import { describe, expect, it } from "vitest";

import { createBoard, createBoardQuery } from "../domain/board.js";
import { DEMO_LEVEL } from "./demo-level.js";

describe("arcade browser demo level", () => {
  it("defines a full maze with four ghosts and a traversable side tunnel", () => {
    const board = createBoard(DEMO_LEVEL);
    const query = createBoardQuery(board);

    expect(board.width).toBe(21);
    expect(board.height).toBe(19);
    expect(board.enemySpawns).toHaveLength(4);
    expect(board.playerSpawn).toEqual({ row: 11, column: 10 });
    expect(query.getAllowedDirectionsForPlayer({ row: 5, column: 0 })).toContain("left");
    expect(query.getAllowedDirectionsForPlayer({ row: 5, column: 20 })).toContain("right");
  });
});
