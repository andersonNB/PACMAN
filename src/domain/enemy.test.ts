import { describe, expect, it } from "vitest";

import { createBoard, createTilePosition, type LevelDefinition } from "./board.js";
import { advanceEnemy, createDeterministicRandom, createEnemy, detectEnemyCollision } from "./enemy.js";
import { tileToWorldPosition } from "./player.js";

const ENEMY_LEVEL: LevelDefinition = {
  id: "phase-4-enemy",
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

describe("enemy movement", () => {
  const board = createBoard(ENEMY_LEVEL);

  it("moves on valid paths only", () => {
    const enemy = createEnemy({
      id: "enemy-1",
      spawnTile: createTilePosition(5, 1),
      velocity: { unitsPerSecond: 2 },
      strategyId: "random",
      scatterTargetTile: createTilePosition(1, 5),
      initialDirection: "right"
    });

    const movedEnemy = advanceEnemy({
      board,
      enemy,
      playerPosition: tileToWorldPosition({ row: 1, column: 1 }),
      deltaMs: 500,
      nextRandom: createDeterministicRandom([0.2])
    });

    expect(movedEnemy.position).toEqual({ x: 2.5, y: 5.5 });
  });

  it("avoids reversing direction when there are alternatives", () => {
    const enemy = createEnemy({
      id: "enemy-1",
      spawnTile: createTilePosition(3, 2),
      velocity: { unitsPerSecond: 2 },
      strategyId: "random",
      scatterTargetTile: createTilePosition(1, 5),
      initialDirection: "left"
    });

    const movedEnemy = advanceEnemy({
      board,
      enemy,
      playerPosition: tileToWorldPosition({ row: 1, column: 1 }),
      deltaMs: 500,
      nextRandom: createDeterministicRandom([0.9])
    });

    expect(movedEnemy.currentDirection).toBe("right");
    expect(movedEnemy.position).toEqual({ x: 3.5, y: 3.5 });
  });
});

describe("enemy collision", () => {
  it("detects collision on the same tile", () => {
    const enemy = createEnemy({
      id: "enemy-1",
      spawnTile: createTilePosition(3, 3),
      velocity: { unitsPerSecond: 2 },
      strategyId: "chase",
      scatterTargetTile: createTilePosition(1, 5)
    });

    expect(
      detectEnemyCollision({
        playerPosition: tileToWorldPosition({ row: 3, column: 3 }),
        previousPlayerPosition: tileToWorldPosition({ row: 3, column: 2 }),
        enemy,
        previousEnemyPosition: tileToWorldPosition({ row: 3, column: 3 })
      })
    ).toBe(true);
  });

  it("detects crossing paths between ticks", () => {
    const enemy = {
      ...createEnemy({
        id: "enemy-1",
        spawnTile: createTilePosition(3, 2),
        velocity: { unitsPerSecond: 2 },
        strategyId: "chase",
        scatterTargetTile: createTilePosition(1, 5)
      }),
      position: tileToWorldPosition({ row: 3, column: 3 })
    };

    expect(
      detectEnemyCollision({
        playerPosition: tileToWorldPosition({ row: 3, column: 2 }),
        previousPlayerPosition: tileToWorldPosition({ row: 3, column: 3 }),
        enemy,
        previousEnemyPosition: tileToWorldPosition({ row: 3, column: 2 })
      })
    ).toBe(true);
  });
});
