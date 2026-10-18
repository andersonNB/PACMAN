import { describe, expect, it } from "vitest";

import { createBoard, createBoardQuery } from "../domain/board.js";
import { DEMO_LEVEL } from "./demo-level.js";
import { validatePlayableBoard } from "../domain/level-validation.js";
import { advanceEnemy, createEnemies, markEnemyAsReturningHome, releaseEnemyFromHome } from "../domain/enemy.js";
import { tileToWorldPosition, worldToTilePosition } from "../domain/player.js";

describe("arcade browser demo level", () => {
  it("has reachable collectibles and connected ghost spawns", () => {
    expect(validatePlayableBoard(createBoard(DEMO_LEVEL))).toEqual({ playable: true, issues: [] });
  });
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

  it("routes every ghost home and out again using browser-sized ticks", () => {
    const board = createBoard(DEMO_LEVEL);
    const query = createBoardQuery(board);
    const origins = [
      { row: 1, column: 1 }, { row: 17, column: 19 },
      { row: 5, column: 0 }, { row: 5, column: 20 }
    ];

    for (const enemy of createEnemies(board, { unitsPerSecond: 2 })) {
      for (const origin of origins) {
        let returned = markEnemyAsReturningHome({ ...enemy, position: tileToWorldPosition(origin) });
        for (let tick = 0; tick < 600 && returned.navigationState !== "insideHome"; tick += 1) {
          returned = advanceEnemy({
            board, enemy: returned,
            playerPosition: tileToWorldPosition(board.playerSpawn),
            playerDirection: "left", deltaMs: 100, nextRandom: () => 0
          });
        }
        expect(returned.navigationState).toBe("insideHome");
        expect(returned.position).toEqual(tileToWorldPosition(enemy.homeTile));

        let released = releaseEnemyFromHome(returned);
        for (let tick = 0; tick < 100 && released.navigationState !== "outside"; tick += 1) {
          released = advanceEnemy({
            board, enemy: released,
            playerPosition: tileToWorldPosition(board.playerSpawn),
            playerDirection: "left", deltaMs: 100, nextRandom: () => 0
          });
        }
        expect(released.navigationState).toBe("outside");
        expect(query.isWalkableForPlayer(worldToTilePosition(released.position))).toBe(true);
      }
    }
  });
});
