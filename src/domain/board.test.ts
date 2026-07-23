import { describe, expect, it } from "vitest";

import { createBoard, createBoardQuery, createTilePosition, type LevelDefinition } from "./board.js";

const TEST_LEVEL: LevelDefinition = {
  id: "phase-1-board",
  rows: [
    "#######",
    "#P...E#",
    "#.#T#.#",
    "#..H..#",
    "#R###.#",
    "#Eo...#",
    "#######"
  ]
};

describe("createBoard", () => {
  it("builds a board with dimensions and spawns", () => {
    const board = createBoard(TEST_LEVEL);

    expect(board.width).toBe(7);
    expect(board.height).toBe(7);
    expect(board.playerSpawn).toEqual({ row: 1, column: 1 });
    expect(board.enemySpawns).toEqual([
      { row: 1, column: 5 },
      { row: 5, column: 1 }
    ]);
  });

  it("rejects irregular maps", () => {
    expect(() =>
      createBoard({
        id: "invalid",
        rows: ["###", "##"]
      })
    ).toThrow("Level rows must have the same width.");
  });
});

describe("createBoardQuery", () => {
  const board = createBoard(TEST_LEVEL);
  const query = createBoardQuery(board);

  it("identifies walls and walkable tiles", () => {
    expect(query.isWalkable(createTilePosition(0, 0))).toBe(false);
    expect(query.isWalkable(createTilePosition(1, 2))).toBe(true);
    expect(query.isWalkable(createTilePosition(4, 1))).toBe(false);
  });

  it("returns allowed directions from a walkable tile", () => {
    expect(query.getAllowedDirections(createTilePosition(1, 3))).toEqual(["left", "right", "down"]);
  });

  it("marks intersections when a tile has at least three exits", () => {
    expect(query.isIntersection(createTilePosition(1, 3))).toBe(true);
    expect(query.isIntersection(createTilePosition(3, 1))).toBe(false);
  });

  it("normalizes tunnel exits when moving outside the horizontal bounds", () => {
    expect(query.normalizeTunnelExit(createTilePosition(2, -1))).toEqual({ row: 2, column: 6 });
    expect(query.normalizeTunnelExit(createTilePosition(2, 7))).toEqual({ row: 2, column: 0 });
  });

  it("treats tunnel tiles as walkable", () => {
    expect(query.getTile(createTilePosition(2, 3))?.kind).toBe("tunnel");
    expect(query.isWalkable(createTilePosition(2, 3))).toBe(true);
  });
});
