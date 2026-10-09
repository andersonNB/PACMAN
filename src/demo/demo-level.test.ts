import { describe, expect, it } from "vitest";

import { createBoard, createBoardQuery } from "../domain/board.js";
import { DEMO_LEVEL } from "./demo-level.js";
import { advanceEnemy, createEnemies, markEnemyAsReturningHome, releaseEnemyFromHome } from "../domain/enemy.js";
import { tileToWorldPosition, worldToTilePosition } from "../domain/player.js";

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

  it("routes every ghost back from distant corridors and out of its home again", () => {
    const board = createBoard(DEMO_LEVEL);
    const query = createBoardQuery(board);
    const origins = [
      { row: 1, column: 1 }, { row: 17, column: 19 },
      { row: 5, column: 0 }, { row: 5, column: 20 }
    ];

    for (const enemy of createEnemies(board, { unitsPerSecond: 2 })) {
      for (const origin of origins) {
        const returned = advanceEnemy({
          board,
          enemy: markEnemyAsReturningHome({ ...enemy, position: tileToWorldPosition(origin) }),
          playerPosition: tileToWorldPosition(board.playerSpawn),
          playerDirection: "left", deltaMs: 60000, nextRandom: () => 0
        });
        expect(returned.navigationState).toBe("insideHome");
        expect(returned.position).toEqual(tileToWorldPosition(enemy.homeTile));

        const released = advanceEnemy({
          board, enemy: releaseEnemyFromHome(returned),
          playerPosition: tileToWorldPosition(board.playerSpawn),
          playerDirection: "left", deltaMs: 3000, nextRandom: () => 0
        });
        expect(released.navigationState).toBe("outside");
        expect(query.isWalkableForPlayer(worldToTilePosition(released.position))).toBe(true);
      }
    }
  });
});
