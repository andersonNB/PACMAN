import { describe, expect, it } from "vitest";
import { createBoard, createTilePosition, type LevelDefinition } from "./board.js";
import { advanceEnemy, createDeterministicRandom, createEnemy, markEnemyAsReturningHome } from "./enemy.js";
import { tileToWorldPosition } from "./player.js";

const RETURN_LEVEL: LevelDefinition = {
  id: "phase-10-return-home",
  rows: [
    "#######",
    "#P....#",
    "#.###.#",
    "#.....#",
    "#.###.#",
    "#E....#",
    "#######"
  ]
};

describe("enemy returningHome", () => {
  it("stops inside home on arrival even when the tick has movement remaining", () => {
    const board = createBoard(RETURN_LEVEL);
    const enemy = markEnemyAsReturningHome({
      ...createEnemy({
        id: "enemy-1",
        spawnTile: createTilePosition(5, 1),
        velocity: { unitsPerSecond: 2 },
        strategyId: "random",
        scatterTargetTile: createTilePosition(1, 5),
        initialDirection: "left"
      }),
      position: tileToWorldPosition({ row: 5, column: 2 })
    });

    const movedEnemy = advanceEnemy({
      board,
      enemy,
      playerPosition: tileToWorldPosition({ row: 1, column: 1 }),
      playerDirection: "left",
      deltaMs: 1000,
      nextRandom: createDeterministicRandom([0.2])
    });

    expect(movedEnemy.position).toEqual({ x: 1.5, y: 5.5 });
    expect(movedEnemy.navigationState).toBe("insideHome");
    expect(movedEnemy.reentryReleaseTimerMs).toBeNull();
  });
});
