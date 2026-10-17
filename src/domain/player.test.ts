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

const TURNING_LEVEL: LevelDefinition = {
  id: "partial-tick-turning",
  rows: [
    "#######",
    "#P..###",
    "###.###",
    "#.....#",
    "#E....#",
    "#######"
  ]
};

describe("player movement", () => {
  const board = createBoard(MOVEMENT_LEVEL);

  it.each([
    ["right", "left", { x: 3.1, y: 3.5 }, { x: 2.9, y: 3.5 }],
    ["left", "right", { x: 3.9, y: 3.5 }, { x: 4.1, y: 3.5 }],
    ["up", "down", { x: 1.5, y: 2.1 }, { x: 1.5, y: 2.3 }],
    ["down", "up", { x: 1.5, y: 2.9 }, { x: 1.5, y: 2.7 }]
  ] as const)("reverses from %s to %s between centers without snapping", (currentDirection, direction, position, expected) => {
    const player = requestPlayerDirection({
      ...createPlayer({ spawnTile: board.playerSpawn, initialDirection: currentDirection, velocity: { unitsPerSecond: 2 } }),
      position
    }, direction);
    const moved = advancePlayer({ board, player, deltaMs: 100 });

    expect(moved.currentDirection).toBe(direction);
    expect(moved.position.x).toBeCloseTo(expected.x);
    expect(moved.position.y).toBeCloseTo(expected.y);
  });

  it("keeps a perpendicular request buffered until reaching a cell center", () => {
    const player = requestPlayerDirection({
      ...createPlayer({ spawnTile: { row: 3, column: 2 }, initialDirection: "left", velocity: { unitsPerSecond: 2 } }),
      position: { x: 1.9, y: 3.5 }
    }, "up");
    const beforeCenter = advancePlayer({ board, player, deltaMs: 100 });
    expect(beforeCenter.currentDirection).toBe("left");
    expect(beforeCenter.requestedDirection).toBe("up");
    expect(beforeCenter.position.x).toBeCloseTo(1.7);
    const atCenter = advancePlayer({ board, player: beforeCenter, deltaMs: 100 });
    expect(atCenter.position).toEqual({ x: 1.5, y: 3.5 });
    expect(atCenter.currentDirection).toBe("up");
  });

  it("reverses across the tunnel seam and continues on later ticks", () => {
    const tunnelBoard = createBoard({ id: "reverse-tunnel", rows: ["#######", "TP...ET", "#######"] });
    const player = requestPlayerDirection({
      ...createPlayer({ spawnTile: { row: 1, column: 0 }, initialDirection: "right", velocity: { unitsPerSecond: 2 } }),
      position: { x: 0.1, y: 1.5 }
    }, "left");
    const reversed = advancePlayer({ board: tunnelBoard, player, deltaMs: 100 });
    expect(reversed.position.x).toBeCloseTo(6.9);
    const continued = advancePlayer({ board: tunnelBoard, player: reversed, deltaMs: 200 });
    expect(continued.position.x).toBeCloseTo(6.5);
    expect(continued.currentDirection).toBe("left");
  });

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

  it("reaches a turn center across partial ticks instead of stopping at the tile boundary", () => {
    const turningBoard = createBoard(TURNING_LEVEL);
    const player = requestPlayerDirection(
      createPlayer({
        spawnTile: createTilePosition(1, 2),
        initialDirection: "right",
        velocity: { unitsPerSecond: 2 }
      }),
      "down"
    );

    const betweenCenters = advancePlayer({ board: turningBoard, player, deltaMs: 300 });
    const atTurnCenter = advancePlayer({ board: turningBoard, player: betweenCenters, deltaMs: 200 });
    const turnedPlayer = advancePlayer({ board: turningBoard, player: atTurnCenter, deltaMs: 250 });

    expect(betweenCenters.position).toEqual({ x: 3.1, y: 1.5 });
    expect(atTurnCenter.position).toEqual({ x: 3.5, y: 1.5 });
    expect(atTurnCenter.currentDirection).toBe("down");
    expect(turnedPlayer.position).toEqual({ x: 3.5, y: 2 });
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
