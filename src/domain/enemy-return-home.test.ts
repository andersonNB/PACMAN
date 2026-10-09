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

  it("can reverse at a junction to take the shortest route home", () => {
    const board = createBoard({
      id: "return-reversal",
      rows: ["#######", "#E...P#", "#.....#", "#######"]
    });
    const enemy = markEnemyAsReturningHome({
      ...createEnemy({
        id: "returning",
        spawnTile: { row: 1, column: 1 },
        velocity: { unitsPerSecond: 2 },
        strategyId: "chase",
        scatterTargetTile: { row: 1, column: 5 },
        initialDirection: "right"
      }),
      position: tileToWorldPosition({ row: 1, column: 2 })
    });
    const moved = advanceEnemy({
      board, enemy,
      playerPosition: tileToWorldPosition(board.playerSpawn),
      playerDirection: "left", deltaMs: 500,
      nextRandom: () => { throw new Error("Return routing must not consume RNG"); }
    });

    expect(moved.navigationState).toBe("insideHome");
    expect(moved.position).toEqual(tileToWorldPosition(enemy.homeTile));
  });

  it("stays still when home is unreachable", () => {
    const board = createBoard({
      id: "blocked-return",
      rows: ["#######", "#E.#.P#", "#######"]
    });
    const enemy = markEnemyAsReturningHome({
      ...createEnemy({
        id: "returning", spawnTile: board.enemySpawns[0]!,
        velocity: { unitsPerSecond: 2 }, strategyId: "chase",
        scatterTargetTile: board.playerSpawn, initialDirection: "left"
      }),
      position: tileToWorldPosition(board.playerSpawn)
    });
    const moved = advanceEnemy({
      board, enemy, playerPosition: enemy.position,
      playerDirection: "left", deltaMs: 2000,
      nextRandom: createDeterministicRandom([0])
    });

    expect(moved).toEqual(enemy);
  });

  it("recovers an enemy that is already centered at home instead of moving away", () => {
    const board = createBoard(RETURN_LEVEL);
    const enemy = markEnemyAsReturningHome(createEnemy({
      id: "returning", spawnTile: { row: 5, column: 1 },
      velocity: { unitsPerSecond: 2 }, strategyId: "chase",
      scatterTargetTile: board.playerSpawn
    }));
    const moved = advanceEnemy({
      board, enemy, playerPosition: tileToWorldPosition(board.playerSpawn),
      playerDirection: "left", deltaMs: 500,
      nextRandom: createDeterministicRandom([0])
    });

    expect(moved.navigationState).toBe("insideHome");
    expect(moved.position).toEqual(enemy.position);
  });
});
