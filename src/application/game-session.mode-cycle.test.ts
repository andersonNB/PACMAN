import { describe, expect, it } from "vitest";
import { createBoard, type LevelDefinition } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import {
  advanceGameSession,
  createGameSession,
  requestDirectionForSession,
  startGameSession
} from "./game-session.js";

const MODE_LEVEL: LevelDefinition = {
  id: "phase-11-mode-cycle",
  rows: [
    "#######",
    "#Po...#",
    "#..E..#",
    "#######"
  ]
};

const createSession = () =>
  startGameSession(
    createGameSession(createBoard(MODE_LEVEL), {
      playerSpeedUnitsPerSecond: 2,
      enemySpeedUnitsPerSecond: 0,
      frightenedDurationMs: 1000,
      enemyReleaseScheduleMs: [1000, 1000],
      enemyModeSchedule: [
        { mode: "scatter", durationMs: 500 },
        { mode: "chase", durationMs: 1000 }
      ],
      initialLives: 3,
      scoring: {
        dotPoints: 10,
        powerPelletPoints: 50,
        enemyPoints: 200
      },
      respawnDelayMs: 1000,
      levelCompletedDelayMs: 1000
    })
  );

describe("game session global enemy mode", () => {
  it("switches from scatter to chase when the schedule timer expires", () => {
    let state = createSession();

    expect(state.globalEnemyMode).toBe("scatter");
    expect(state.globalEnemyModeTimerMs).toBe(500);

    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.globalEnemyMode).toBe("chase");
    expect(state.globalEnemyModeTimerMs).toBe(1000);
    expect(state.enemies.every((enemy) => enemy.behaviorMode === "chase")).toBe(true);
  });

  it("pauses the scatter/chase timer while frightened is active", () => {
    let state = createSession();

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.frightenedTimerMs).toBe(1000);
    expect(state.globalEnemyMode).toBe("scatter");
    expect(state.globalEnemyModeTimerMs).toBe(500);

    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.frightenedTimerMs).toBe(500);
    expect(state.globalEnemyMode).toBe("scatter");
    expect(state.globalEnemyModeTimerMs).toBe(500);
  });
});
