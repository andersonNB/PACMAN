import { describe, expect, it } from "vitest";

import { createBoard, type LevelDefinition } from "./board.js";
import {
  activateEligibleFruits,
  advanceFruitTimers,
  collectAtPlayerTile,
  createCollectiblesFromBoard,
  deferFruitSpawn
} from "./collectibles.js";
import { tileToWorldPosition } from "./player.js";

const LEVEL: LevelDefinition = {
  id: "phase-3-collectibles",
  rows: [
    "#######",
    "#Po..F#",
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
    powerPelletPoints: 50,
    fruitPoints: 100
  });

  it("creates collectibles for walkable tiles except spawns", () => {
    expect(collectibles.some((collectible) => collectible.tile.row === 1 && collectible.tile.column === 1)).toBe(false);
    expect(collectibles.some((collectible) => collectible.tile.row === 5 && collectible.tile.column === 1)).toBe(false);
    expect(collectibles.some((collectible) => collectible.tile.row === 1 && collectible.tile.column === 2)).toBe(true);
  });

  it("collects a dot once and increases score", () => {
    const result = collectAtPlayerTile({
      collectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 3 })
    });

    expect(result.collected).toHaveLength(1);
    expect(result.scoreDelta).toBe(10);
    expect(result.frightenedTriggered).toBe(false);
    expect(result.collectibles.find((collectible) => collectible.tile.row === 1 && collectible.tile.column === 3)?.active).toBe(
      false
    );
  });

  it("does not recollect an inactive dot", () => {
    const firstCollection = collectAtPlayerTile({
      collectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 3 })
    });

    const secondCollection = collectAtPlayerTile({
      collectibles: firstCollection.collectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 3 })
    });

    expect(secondCollection.collected).toHaveLength(0);
    expect(secondCollection.scoreDelta).toBe(0);
    expect(secondCollection.frightenedTriggered).toBe(false);
  });

  it("marks the level as completed when no active collectibles remain", () => {
    const inactiveCollectibles = collectibles.map((collectible) => ({
      ...collectible,
      active: collectible.tile.row === 1 && collectible.tile.column === 3
    }));

    const result = collectAtPlayerTile({
      collectibles: inactiveCollectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 3 })
    });

    expect(result.nextStatus).toBe("levelCompleted");
  });

  it("flags frightened mode when collecting a power pellet", () => {
    const result = collectAtPlayerTile({
      collectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 2 })
    });

    expect(result.scoreDelta).toBe(50);
    expect(result.frightenedTriggered).toBe(true);
  });

  it("collects a fruit once with its configured score", () => {
    const result = collectAtPlayerTile({
      collectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 5 })
    });

    expect(result.collected.map((collectible) => collectible.kind)).toEqual(["fruit"]);
    expect(result.scoreDelta).toBe(100);
    expect(result.frightenedTriggered).toBe(false);
    expect(result.collectibles.find((collectible) => collectible.kind === "fruit")).toMatchObject({
      active: false,
      collected: true
    });
  });

  it("does not require an uncollected fruit to complete the level", () => {
    const fruitOnly = collectibles.map((collectible) => ({
      ...collectible,
      active: collectible.kind === "fruit"
    }));

    const result = collectAtPlayerTile({
      collectibles: fruitOnly,
      playerPosition: tileToWorldPosition({ row: 1, column: 3 })
    });

    expect(result.nextStatus).toBe("levelCompleted");
  });

  it("activates deferred fruit for each configured threshold without unlimited respawns", () => {
    const deferredCollectibles = deferFruitSpawn(collectibles, [2, 4]);
    const fruitBeforeThreshold = deferredCollectibles.find((collectible) => collectible.kind === "fruit");
    const firstTwoDotIds = deferredCollectibles
      .filter((collectible) => collectible.kind === "dot")
      .slice(0, 2)
      .map((collectible) => collectible.id);
    const withTwoCollectedDots = deferredCollectibles.map((collectible) =>
      firstTwoDotIds.includes(collectible.id) ? { ...collectible, active: false } : collectible
    );
    const activatedCollectibles = activateEligibleFruits(withTwoCollectedDots, [2, 4], 500, [125, 300]);
    const activeFruit = activatedCollectibles.find((collectible) => collectible.kind === "fruit");
    const collectedFirstFruit = collectAtPlayerTile({
      collectibles: activatedCollectibles,
      playerPosition: tileToWorldPosition({ row: 1, column: 5 })
    }).collectibles;
    const firstFourDotIds = deferredCollectibles
      .filter((collectible) => collectible.kind === "dot")
      .slice(0, 4)
      .map((collectible) => collectible.id);
    const withFourCollectedDots = collectedFirstFruit.map((collectible) =>
      firstFourDotIds.includes(collectible.id) ? { ...collectible, active: false } : collectible
    );
    const activatedSecondFruit = activateEligibleFruits(withFourCollectedDots, [2, 4], 500, [125, 300]);
    const expiredSecondFruit = advanceFruitTimers(activatedSecondFruit, 500);

    expect(fruitBeforeThreshold).toMatchObject({ active: false, spawned: false, spawnCount: 0 });
    expect(activeFruit).toMatchObject({ active: true, spawned: true, spawnCount: 1, points: 125, collected: false, remainingMs: 500 });
    expect(activatedSecondFruit.find((collectible) => collectible.kind === "fruit")).toMatchObject({
      active: true,
      spawned: true,
      spawnCount: 2,
      points: 300,
      collected: false,
      remainingMs: 500
    });
    expect(activateEligibleFruits(expiredSecondFruit, [2, 4], 500, [125, 300]).find((collectible) => collectible.kind === "fruit")).toMatchObject({
      active: false,
      spawned: true,
      spawnCount: 2,
      points: 300,
      collected: false,
      remainingMs: 0
    });
  });
});
