import { describe, expect, it } from "vitest";

import { createBoard, type LevelDefinition } from "./board.js";
import { collectAtPlayerTile, createCollectiblesFromBoard } from "./collectibles.js";
import { tileToWorldPosition } from "./player.js";

const LEVEL: LevelDefinition = {
  id: "phase-3-collectibles",
  rows: [
    "#######",
    "#P....#",
    "#.###.#",
    "#...T.#",
    "#.###.#",
    "#E....#",
    "#######"
  ]
};

describe("collectibles", () => {
  const board = createBoard(LEVEL);
  const collectibles = createCollectiblesFromBoard(board, {
    dotPoints: 10,
    powerPelletPoints: 50
  });

  it("creates collectibles for walkable tiles except spawns", () => {
    expect(collectibles.some((collectible) => collectible.tile.row === 1 && collectible.tile.column === 1)).toBe(false);
    expect(collectibles.some((collectible) => collectible.tile.row === 5 && collectible.tile.column === 1)).toBe(false);
    expect(collectibles.some((collectible) => collectible.tile.row === 1 && collectible.tile.column === 2)).toBe(true);
  });

  it("collects a dot once and increases score", () => {
    const result = collectAtPlayerTile({
      collectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 2 })
    });

    expect(result.collected).toHaveLength(1);
    expect(result.scoreDelta).toBe(10);
    expect(result.collectibles.find((collectible) => collectible.tile.row === 1 && collectible.tile.column === 2)?.active).toBe(
      false
    );
  });

  it("does not recollect an inactive dot", () => {
    const firstCollection = collectAtPlayerTile({
      collectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 2 })
    });

    const secondCollection = collectAtPlayerTile({
      collectibles: firstCollection.collectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 2 })
    });

    expect(secondCollection.collected).toHaveLength(0);
    expect(secondCollection.scoreDelta).toBe(0);
  });

  it("marks the level as completed when no active collectibles remain", () => {
    const inactiveCollectibles = collectibles.map((collectible) => ({
      ...collectible,
      active: collectible.tile.row === 1 && collectible.tile.column === 2
    }));

    const result = collectAtPlayerTile({
      collectibles: inactiveCollectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 2 })
    });

    expect(result.nextStatus).toBe("levelCompleted");
  });
});
