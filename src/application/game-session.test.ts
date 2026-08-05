import { describe, expect, it } from "vitest";

import { createBoard, type LevelDefinition } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import {
  advanceGameSession,
  createGameSession,
  pauseGameSession,
  requestDirectionForSession,
  restartGameSession,
  resumeGameSession,
  startGameSession
} from "./game-session.js";

const LEVEL: LevelDefinition = {
  id: "phase-6-session",
  rows: [
    "#######",
    "#P....#",
    "#.###.#",
    "#.....#",
    "#.###.#",
    "#E....#",
    "#######"
  ]
};

const createSession = () =>
  startGameSession(
    createGameSession(createBoard(LEVEL), {
      playerSpeedUnitsPerSecond: 2,
      enemySpeedUnitsPerSecond: 2,
      frightenedDurationMs: 1200,
      initialLives: 2,
      scoring: {
        dotPoints: 10,
        powerPelletPoints: 50,
        enemyPoints: 200
      },
      respawnDelayMs: 1000,
      levelCompletedDelayMs: 1000
    })
  );

describe("game session states", () => {
  it("pauses and resumes only through explicit transitions", () => {
    const runningState = createSession();
    const pausedState = pauseGameSession(runningState);
    const advancedWhilePaused = advanceGameSession(pausedState, 500, createDeterministicRandom([0.2]));
    const resumedState = resumeGameSession(pausedState);

    expect(pausedState.status).toBe("paused");
    expect(advancedWhilePaused.tick).toBe(pausedState.tick);
    expect(resumedState.status).toBe("running");
  });

  it("enters playerDying and returns to running after the respawn delay", () => {
    let state = createSession();

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 1500, createDeterministicRandom([0, 0]));

    expect(state.status).toBe("playerDying");
    expect(state.lives.value).toBe(1);

    state = advanceGameSession(state, 1000, createDeterministicRandom([0, 0]));

    expect(state.status).toBe("running");
    expect(state.player.position).toEqual({ x: 1.5, y: 1.5 });
  });

  it("reaches gameOver when the player loses the last life", () => {
    let state = createSession();

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 1500, createDeterministicRandom([0, 0]));
    state = advanceGameSession(state, 1000, createDeterministicRandom([0, 0]));
    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 1500, createDeterministicRandom([0, 0]));

    expect(state.status).toBe("gameOver");
    expect(state.lives.value).toBe(0);
  });

  it("restarts back to the initial seed state", () => {
    let state = createSession();

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    const restartedState = restartGameSession(state);

    expect(restartedState.status).toBe("idle");
    expect(restartedState.score.value).toBe(0);
    expect(restartedState.lives.value).toBe(2);
    expect(restartedState.tick).toBe(0);
    expect(restartedState.player.position).toEqual({ x: 1.5, y: 1.5 });
  });

  it("promotes levelCompleted to victory after the configured delay", () => {
    let state = createSession();

    state = {
      ...state,
      collectibles: [],
      status: "levelCompleted",
      phaseTimerMs: 1000
    };

    state = advanceGameSession(state, 1000, createDeterministicRandom([0.2]));

    expect(state.status).toBe("victory");
  });
});
