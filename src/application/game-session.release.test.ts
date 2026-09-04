import { describe, expect, it } from "vitest";
import { createBoard, type LevelDefinition } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import { createGameSession, advanceGameSession, startGameSession } from "./game-session.js";

const RELEASE_LEVEL: LevelDefinition = {
  id: "phase-12-release",
  rows: [
    "########",
    "#P.....#",
    "#......#",
    "#..E.E.#",
    "########"
  ]
};

const createSession = () =>
  startGameSession(
    createGameSession(createBoard(RELEASE_LEVEL), {
      playerSpeedUnitsPerSecond: 2,
      enemySpeedUnitsPerSecond: 2,
      frightenedDurationMs: 1000,
      enemyReleaseScheduleMs: [500, 1000],
      enemyModeSchedule: [
        { mode: "scatter", durationMs: 2000 },
        { mode: "chase", durationMs: 2000 }
      ],
      initialLives: 3,
      scoring: {
        dotPoints: 10,
        powerPelletPoints: 50,
        fruitPoints: 100,
        enemyPoints: 200
      },
      respawnDelayMs: 1000,
      levelCompletedDelayMs: 1000
    })
  );

describe("game session enemy release", () => {
  it("keeps secondary enemies insideHome until the release timer expires", () => {
    const state = createSession();

    expect(state.enemies[0]?.navigationState).toBe("outside");
    expect(state.enemies[1]?.navigationState).toBe("insideHome");
    expect(state.enemyReleaseTimerMs).toBe(500);
  });

  it("releases the next enemy when the timer reaches zero", () => {
    let state = createSession();

    for (let index = 0; index < 5; index += 1) {
      state = advanceGameSession(state, 100, createDeterministicRandom([0.2]));
    }

    expect(state.enemies[1]?.navigationState).toBe("leavingHome");
    expect(state.enemies[1]?.currentDirection).toBe("up");
    expect(state.nextEnemyReleaseIndex).toBe(2);
    expect(state.enemyReleaseTimerMs).toBeNull();
  });

  it("promotes a leavingHome enemy to outside after it reaches the exit lane", () => {
    let state = createSession();

    for (let index = 0; index < 9; index += 1) {
      state = advanceGameSession(state, 100, createDeterministicRandom([0.2]));
    }

    expect(state.enemies[1]?.navigationState).toBe("outside");
    expect(state.enemies[1]?.position).toEqual({ x: 5.5, y: 2.5 });
  });
});
