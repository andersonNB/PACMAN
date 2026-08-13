import { describe, expect, it } from "vitest";

import { createBoard, createTilePosition, type LevelDefinition } from "./board.js";
import { advancePlayer, createPlayer, requestPlayerDirection, worldToTilePosition } from "./player.js";

const MOVEMENT_LEVEL: LevelDefinition = {
  id: "phase-2-player",
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

describe("player movement", () => {
  const board = createBoard(MOVEMENT_LEVEL);

  it("moves one tile in the current direction when the path is open", () => {
    const player = createPlayer({
      spawnTile: board.playerSpawn,
      initialDirection: "right",
      velocity: { unitsPerSecond: 2 }
    });

    const movedPlayer = advancePlayer({
      board,
      player,
      deltaMs: 500
    });

    expect(worldToTilePosition(movedPlayer.position)).toEqual({ row: 1, column: 2 });
  });

  it("keeps moving on the current lane until the requested turn becomes available", () => {
    const player = requestPlayerDirection(
      createPlayer({
        spawnTile: createTilePosition(3, 1),
        initialDirection: "right",
        velocity: { unitsPerSecond: 2 }
      }),
      "left"
    );

    const movedPlayer = advancePlayer({
      board,
      player,
      deltaMs: 500
    });

    expect(worldToTilePosition(movedPlayer.position)).toEqual({ row: 3, column: 2 });
    expect(movedPlayer.currentDirection).toBe("left");
  });

  it("turns into the requested direction when it reaches a valid intersection", () => {
    const player = requestPlayerDirection(
      createPlayer({
        spawnTile: createTilePosition(3, 2),
        initialDirection: "left",
        velocity: { unitsPerSecond: 2 }
      }),
      "up"
    );

    const movedPlayer = advancePlayer({
      board,
      player,
      deltaMs: 500
    });

    expect(worldToTilePosition(movedPlayer.position)).toEqual({ row: 3, column: 1 });
    expect(movedPlayer.currentDirection).toBe("up");
  });

  it("stops at the tile center when both current and requested directions are blocked", () => {
    const player = requestPlayerDirection(
      createPlayer({
        spawnTile: createTilePosition(1, 5),
        initialDirection: "right",
        velocity: { unitsPerSecond: 2 }
      }),
      "up"
    );

    const movedPlayer = advancePlayer({
      board,
      player,
      deltaMs: 500
    });

    expect(worldToTilePosition(movedPlayer.position)).toEqual({ row: 1, column: 5 });
    expect(movedPlayer.position).toEqual({ x: 5.5, y: 1.5 });
  });

  it("supports immediate direction reversal", () => {
    const player = requestPlayerDirection(
      createPlayer({
        spawnTile: createTilePosition(3, 3),
        initialDirection: "right",
        velocity: { unitsPerSecond: 2 }
      }),
      "left"
    );

    const movedPlayer = advancePlayer({
      board,
      player,
      deltaMs: 500
    });

    expect(worldToTilePosition(movedPlayer.position)).toEqual({ row: 3, column: 2 });
    expect(movedPlayer.currentDirection).toBe("left");
  });
});
