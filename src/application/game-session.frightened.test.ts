import { describe, expect, it } from "vitest";
import { createBoard, type LevelDefinition } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import { tileToWorldPosition } from "../domain/player.js";
import {
  advanceGameSession,
  createGameSession,
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

const createSession = () =>
  startGameSession(
    createGameSession(createBoard(FRIGHTENED_LEVEL), {
      playerSpeedUnitsPerSecond: 2,
      enemySpeedUnitsPerSecond: 0,
      frightenedDurationMs: 1000,
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

describe("game session frightened mode", () => {
  it("activates frightened mode after collecting a power pellet and restores enemy modes after timeout", () => {
    let state = createSession();

    state = requestDirectionForSession(state, "right");
    state = advanceGameSession(state, 500, createDeterministicRandom([0.2]));

    expect(state.frightenedTimerMs).toBe(1000);
    expect(state.enemies.every((enemy) => enemy.behaviorMode === "frightened")).toBe(true);

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

  it("resets returningHome enemies to outside mode once they reach home", () => {
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
    expect(state.enemies[0]?.navigationState).toBe("outside");
  });
});
