import { describe, expect, it } from "vitest";
import { createBoard, createBoardQuery } from "./board.js";
import { chooseShortestEnemyDirection } from "./enemy-navigation.js";

describe("enemy shortest routes", () => {
  it("takes a detour away from home to get around a wall", () => {
    const query = createBoardQuery(createBoard({
      id: "detour",
      rows: ["#######", "#E.#.P#", "#..#..#", "#.....#", "#######"]
    }));

    expect(chooseShortestEnemyDirection(query, { row: 1, column: 4 },
      { row: 1, column: 1 }, "returningHome")).toBe("down");
  });

  it("uses a tunnel when it is the shortest route", () => {
    const query = createBoardQuery(createBoard({
      id: "tunnel-route",
      rows: ["#######", "TE...PT", "#######"]
    }));

    expect(chooseShortestEnemyDirection(query, { row: 1, column: 5 },
      { row: 1, column: 1 }, "returningHome")).toBe("right");
  });

  it("respects house access for each navigation state", () => {
    const query = createBoardQuery(createBoard({
      id: "house-route",
      rows: ["#######", "#P.RHE#", "#######"]
    }));
    const origin = { row: 1, column: 2 };
    const target = { row: 1, column: 5 };

    expect(chooseShortestEnemyDirection(query, origin, target, "returningHome")).toBe("right");
    expect(chooseShortestEnemyDirection(query, origin, target, "outside")).toBeNull();
  });

  it("returns no direction for an unreachable or already reached target", () => {
    const query = createBoardQuery(createBoard({
      id: "unreachable",
      rows: ["#######", "#E.#.P#", "#######"]
    }));
    const target = { row: 1, column: 1 };

    expect(chooseShortestEnemyDirection(query, { row: 1, column: 5 }, target, "returningHome")).toBeNull();
    expect(chooseShortestEnemyDirection(query, target, target, "returningHome")).toBeNull();
  });

  it("resolves equal-length paths in board direction order", () => {
    const query = createBoardQuery(createBoard({
      id: "equal-routes",
      rows: ["#####", "#E..#", "#...#", "#..P#", "#####"]
    }));

    expect(chooseShortestEnemyDirection(query, { row: 3, column: 3 },
      { row: 1, column: 1 }, "returningHome")).toBe("up");
  });
});
