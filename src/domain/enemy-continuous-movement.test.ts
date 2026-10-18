import { describe, expect, it } from "vitest";
import { createBoard } from "./board.js";
import { advanceEnemy, createEnemy } from "./enemy.js";
import type { Enemy } from "./entities.js";
import { tileToWorldPosition } from "./player.js";

const board = createBoard({
  id: "enemy-corners",
  rows: ["#######", "#P....#", "#.###.#", "#E....#", "#######"]
});
const advance = (enemy: Enemy, deltaMs: number, level = board): Enemy => advanceEnemy({
  board: level, enemy, deltaMs,
  playerPosition: tileToWorldPosition(level.playerSpawn),
  playerDirection: "left", nextRandom: () => 0
});

describe("continuous enemy movement", () => {
  it.each([
    ["right", { row: 1, column: 4 }, { row: 3, column: 5 }, { x: 5.5, y: 1.7 }, "down"],
    ["left", { row: 3, column: 2 }, { row: 1, column: 1 }, { x: 1.5, y: 3.3 }, "up"],
    ["up", { row: 2, column: 1 }, { row: 1, column: 5 }, { x: 1.7, y: 1.5 }, "right"],
    ["down", { row: 2, column: 5 }, { row: 3, column: 1 }, { x: 5.3, y: 3.5 }, "left"]
  ] as const)("reaches a corner going %s across partial ticks and then turns", (direction, spawn, target, expected, turn) => {
    const enemy = createEnemy({
      id: "corner-ghost", spawnTile: spawn, initialDirection: direction,
      velocity: { unitsPerSecond: 2 }, strategyId: "chase",
      behaviorMode: "scatter", scatterTargetTile: target
    });
    const partial = advance(advance(advance(enemy, 300), 200), 100);
    const single = advance(enemy, 600);

    expect(partial.position.x).toBeCloseTo(expected.x);
    expect(partial.position.y).toBeCloseTo(expected.y);
    expect(partial.currentDirection).toBe(turn);
    expect(partial.position.x).toBeCloseTo(single.position.x);
    expect(partial.position.y).toBeCloseTo(single.position.y);
  });

  it.each(["left", "right"] as const)("continues through the tunnel seam going %s", (direction) => {
    const tunnel = createBoard({ id: "enemy-tunnel", rows: ["#######", "TP...ET", "#######"] });
    const enemy = createEnemy({
      id: "tunnel-ghost", spawnTile: { row: 1, column: direction === "left" ? 0 : 6 },
      initialDirection: direction, velocity: { unitsPerSecond: 2 },
      strategyId: "chase", behaviorMode: "scatter", scatterTargetTile: { row: 1, column: 3 }
    });
    let partial = enemy;
    for (let tick = 0; tick < 5; tick += 1) partial = advance(partial, 100, tunnel);
    const single = advance(enemy, 500, tunnel);

    expect(partial.position.x).toBeCloseTo(direction === "left" ? 6.5 : 0.5);
    expect(partial.position.x).toBeCloseTo(single.position.x);
    expect(partial.position.y).toBe(1.5);
  });

  it("still stops at a dead-end center instead of entering a wall", () => {
    const deadEnd = createBoard({ id: "enemy-dead-end", rows: ["#######", "#P..E##", "#######"] });
    const enemy = createEnemy({
      id: "wall-ghost", spawnTile: { row: 1, column: 3 }, initialDirection: "right",
      velocity: { unitsPerSecond: 2 }, strategyId: "chase",
      behaviorMode: "scatter", scatterTargetTile: { row: 1, column: 4 }
    });
    const arrived = advance(advance(enemy, 300, deadEnd), 200, deadEnd);
    expect(arrived.position).toEqual({ x: 4.5, y: 1.5 });
    const turned = advance(arrived, 100, deadEnd);
    expect(turned.currentDirection).toBe("left");
    expect(turned.position.x).toBeCloseTo(4.3);
  });
});
