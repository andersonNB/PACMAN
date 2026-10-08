import { describe, expect, it } from "vitest";
import { createBoard, type LevelDefinition } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import { tileToWorldPosition } from "../domain/player.js";
import {
  advanceGameSession,
  createGameSession,
  pauseGameSession,
  resumeGameSession,
  restartGameSession,
  requestDirectionForSession,
  startGameSession
} from "./game-session.js";

const FRIGHTENED_LEVEL: LevelDefinition = {
  id: "phase-9-frightened",
  rows: [
    "#######",
    "#Po...#",
    "#..E..#",
    "#######"
  ]
};

const createSession = (returningHomeReleaseDelayMs = 1500) =>
  startGameSession(
    createGameSession(createBoard(FRIGHTENED_LEVEL), {
      playerSpeedUnitsPerSecond: 2,
      enemySpeedUnitsPerSecond: 0,
      frightenedDurationMs: 1000,
      returningHomeReleaseDelayMs,
      enemyReleaseScheduleMs: [1000, 1000],
      enemyModeSchedule: [
        { mode: "scatter", durationMs: 3000 },
        { mode: "chase", durationMs: 6000 }
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

describe("game session frightened mode", () => {
  it("activates frightened mode after collecting a power pellet and restores enemy modes after timeout", () => {
    let state = createSession();

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.frightenedTimerMs).toBe(1000);
    expect(state.globalEnemyMode).toBe("scatter");
    expect(state.enemies.every((enemy) => enemy.behaviorMode === "frightened")).toBe(true);
    expect(state.enemies[0]?.currentDirection).toBe("right");

    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.frightenedTimerMs).toBe(500);
    expect(state.enemies.every((enemy) => enemy.behaviorMode === "frightened")).toBe(true);

    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.frightenedTimerMs).toBeNull();
    expect(state.enemies[0]?.behaviorMode).toBe("chase");
  });

  it("sends frightened enemies back home and awards score instead of costing a life", () => {
    let state = createSession();

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    state = {
      ...state,
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        position: tileToWorldPosition({ row: 1, column: 3 })
      }))
    };

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.status).toBe("running");
    expect(state.lives.value).toBe(3);
    expect(state.score.value).toBe(260);
    expect(state.frightenedChainCount).toBe(1);
    expect(state.enemies[0]?.position).toEqual(tileToWorldPosition({ row: 1, column: 3 }));
    expect(state.enemies[0]?.navigationState).toBe("returningHome");
  });

  it("chains enemy score within the same frightened window", () => {
    let state = createSession();

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    state = {
      ...state,
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        position: tileToWorldPosition({ row: 1, column: 3 })
      }))
    };

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    state = {
      ...state,
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        position: tileToWorldPosition({ row: 1, column: 3 }),
        navigationState: "outside",
        behaviorMode: "frightened"
      }))
    };

    state = advanceGameSession(state, 100, createDeterministicRandom([0.2]));

    expect(state.score.value).toBe(660);
    expect(state.frightenedChainCount).toBe(2);
  });

  it("waits inside home after returning, freezes on pause and leaves after the delay", () => {
    let state = createSession();

    state = {
      ...state,
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        position: tileToWorldPosition({ row: 2, column: 4 }),
        velocity: { unitsPerSecond: 2 },
        currentDirection: "left",
        navigationState: "returningHome",
        behaviorMode: "chase"
      }))
    };

    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.enemies[0]?.position).toEqual(tileToWorldPosition({ row: 2, column: 3 }));
    expect(state.enemies[0]?.behaviorMode).toBe("chase");
    expect(state.enemies[0]?.navigationState).toBe("insideHome");
    expect(state.enemies[0]?.reentryReleaseTimerMs).toBe(1500);

    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));
    expect(state.enemies[0]?.reentryReleaseTimerMs).toBe(1000);
    expect(state.enemies[0]?.position).toEqual(tileToWorldPosition({ row: 2, column: 3 }));

    state = pauseGameSession(state);
    expect(advanceGameSession(state, 2000)).toBe(state);
    state = resumeGameSession(state);
    state = advanceGameSession(state, 1000, createDeterministicRandom([0.2]));
    expect(state.enemies[0]?.navigationState).toBe("leavingHome");
    expect(state.enemies[0]?.reentryReleaseTimerMs).toBeNull();
    expect(state.enemies[0]?.position).toEqual(tileToWorldPosition({ row: 2, column: 3 }));

    state = advanceGameSession(state, 100, createDeterministicRandom([0.2]));
    expect(state.enemies[0]?.position.y).toBeCloseTo(2.3);
    expect(restartGameSession(state).enemies[0]?.reentryReleaseTimerMs).toBeNull();
  });

  it("uses only the time left after the reentry delay for movement", () => {
    let state = createSession();
    state = {
      ...state,
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        navigationState: "insideHome",
        reentryReleaseTimerMs: 200,
        velocity: { unitsPerSecond: 2 }
      }))
    };

    state = advanceGameSession(state, 300, createDeterministicRandom([0.2]));
    expect(state.enemies[0]?.navigationState).toBe("leavingHome");
    expect(state.enemies[0]?.reentryReleaseTimerMs).toBeNull();
    expect(state.enemies[0]?.position.y).toBeCloseTo(2.3);
  });

  it("does not award enemy points for a frightened ghost waiting inside home", () => {
    let state = createSession();
    state = {
      ...state,
      frightenedTimerMs: 1000,
      player: { ...state.player, velocity: { unitsPerSecond: 0 } },
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        position: state.player.position,
        navigationState: "insideHome",
        behaviorMode: "frightened",
        reentryReleaseTimerMs: 500
      }))
    };

    state = advanceGameSession(state, 100, createDeterministicRandom([0.2]));
    expect(state.score.value).toBe(0);
    expect(state.lives.value).toBe(3);
    expect(state.enemies[0]?.navigationState).toBe("insideHome");
    expect(state.enemies[0]?.reentryReleaseTimerMs).toBe(400);
  });

  it("allows a zero reentry delay without moving past home in the arrival tick", () => {
    let state = createSession(0);
    state = {
      ...state,
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        position: tileToWorldPosition({ row: 2, column: 4 }),
        velocity: { unitsPerSecond: 2 },
        currentDirection: "left",
        navigationState: "returningHome"
      }))
    };

    state = advanceGameSession(state, 800, createDeterministicRandom([0.2]));
    expect(state.enemies[0]?.position).toEqual(tileToWorldPosition({ row: 2, column: 3 }));
    expect(state.enemies[0]?.navigationState).toBe("leavingHome");
    expect(state.enemies[0]?.reentryReleaseTimerMs).toBeNull();
  });

  it("keeps returning eyes immune when another power pellet is collected", () => {
    let state = createSession();
    state = {
      ...state,
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        navigationState: "returningHome",
        behaviorMode: "chase"
      }))
    };

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));
    expect(state.frightenedTimerMs).toBe(1000);
    expect(state.enemies[0]?.navigationState).toBe("returningHome");
    expect(state.enemies[0]?.behaviorMode).toBe("chase");
  });
});
