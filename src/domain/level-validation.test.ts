import { describe, expect, it } from "vitest";
import { createBoard } from "./board.js";
import { validatePlayableBoard } from "./level-validation.js";

const validate = (rows: readonly string[]) => validatePlayableBoard(createBoard({ id: "validation", rows }));

describe("playable level validation", () => {
  it("accepts a connected map including house and restricted tiles for enemies", () => {
    expect(validate(["#######", "#P.o..#", "###R###", "###HE##", "#######"]))
      .toEqual({ playable: true, issues: [] });
  });

  it("reports every collectible cut off from the player by restricted tiles", () => {
    expect(validate(["#########", "#P.E#...#", "####R####", "#########"]).issues).toEqual([
      { code: "unreachableCollectible", tile: { row: 1, column: 5 } },
      { code: "unreachableCollectible", tile: { row: 1, column: 6 } },
      { code: "unreachableCollectible", tile: { row: 1, column: 7 } }
    ]);
    expect(validate(["#######", "#P.REo#", "#######"]).issues).toContainEqual({
      code: "unreachableCollectible", tile: { row: 1, column: 5 }
    });
  });

  it("includes optional fruit in reachability checks", () => {
    expect(validate(["#######", "#P.E#F#", "#######"]).issues).toContainEqual({
      code: "unreachableCollectible", tile: { row: 1, column: 5 }
    });
  });

  it("rejects disconnected enemy spawns and maps with no pellets", () => {
    expect(validate(["#######", "#P ##E#", "#######"])).toEqual({ playable: false, issues: [
      { code: "noPellets", tile: null },
      { code: "disconnectedEnemySpawn", tile: { row: 1, column: 5 } }
    ] });
  });

  it("considers the side tunnel when checking connected regions", () => {
    expect(validate(["#######", "TP#E.oT", "#######"]).playable).toBe(true);
  });
});
