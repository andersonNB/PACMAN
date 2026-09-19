import { describe, expect, it } from "vitest";

import { createBoard, type LevelDefinition } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import { advanceGameSession, createGameSession, requestDirectionForSession, startGameSession } from "./game-session.js";

const LEVEL: LevelDefinition = {
  id: "phase-24-extra-life",
  rows: [
    "######",
    "#P..E#",
    "######"
  ]
};

describe("game session extra life", () => {
  it("awards one life when the score crosses the configured threshold", () => {
    let state = startGameSession(
      createGameSession(createBoard(LEVEL), {
        playerSpeedUnitsPerSecond: 2,
        enemySpeedUnitsPerSecond: 0,
        extraLifeScore: 500,
        frightenedDurationMs: 1000,
        enemyReleaseScheduleMs: [],
        enemyModeSchedule: [],
        initialLives: 3,
        scoring: { dotPoints: 10, powerPelletPoints: 50, fruitPoints: 100, enemyPoints: 200 },
        respawnDelayMs: 1000,
        levelCompletedDelayMs: 1000
      })
    );
    state = { ...state, score: { value: 490 } };

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.score.value).toBe(500);
    expect(state.lives.value).toBe(4);
    expect(state.extraLifeAwarded).toBe(true);

    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.lives.value).toBe(4);
  });
});
