import { describe, expect, it } from "vitest";

import {
  ambushStrategy,
  chasePlayerStrategy,
  fleeStrategy,
  patrolStrategy,
  randomMovementStrategy
} from "./enemy-strategies.js";
import type { EnemyDecisionContext } from "./services.js";

const createContext = (overrides: Partial<EnemyDecisionContext> = {}): EnemyDecisionContext => ({
  selfId: "enemy-1",
  currentTile: { row: 3, column: 3 },
  currentDirection: "left",
  availableDirections: ["up", "left", "right"],
  playerTile: { row: 1, column: 3 },
  playerDirection: "right",
  homeTile: { row: 5, column: 1 },
  scatterTargetTile: { row: 5, column: 5 },
  randomValue: 0.75,
  ...overrides
});

describe("enemy strategies", () => {
  it("random strategy chooses a valid direction using the random value", () => {
    expect(randomMovementStrategy.chooseDirection(createContext())).toBe("right");
  });

  it("chase strategy picks the direction that gets closer to the player", () => {
    expect(chasePlayerStrategy.chooseDirection(createContext())).toBe("up");
  });

  it("ambush strategy targets tiles ahead of the player direction", () => {
    expect(
      ambushStrategy.chooseDirection(
        createContext({
          currentTile: { row: 4, column: 2 },
          availableDirections: ["up", "right", "left"],
          playerTile: { row: 4, column: 4 },
          playerDirection: "up"
        })
      )
    ).toBe("up");
  });

  it("patrol strategy heads toward the scatter target", () => {
    expect(patrolStrategy.chooseDirection(createContext())).toBe("right");
  });

  it("flee strategy moves away from the player", () => {
    expect(fleeStrategy.chooseDirection(createContext())).toBe("left");
  });
});
