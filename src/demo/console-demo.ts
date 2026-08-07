import { createBoard } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import {
  advanceGameSession,
  createGameSession,
  pauseGameSession,
  requestDirectionForSession,
  resumeGameSession,
  restartGameSession,
  startGameSession
} from "../application/game-session.js";
import { renderBoardState } from "../presentation/console.js";
import { DEMO_LEVEL } from "./demo-level.js";

let state = startGameSession(
  createGameSession(createBoard(DEMO_LEVEL), {
    playerSpeedUnitsPerSecond: 2,
    enemySpeedUnitsPerSecond: 2,
    frightenedDurationMs: 4000,
    enemyModeSchedule: [
      { mode: "scatter", durationMs: 3000 },
      { mode: "chase", durationMs: 6000 },
      { mode: "scatter", durationMs: 3000 },
      { mode: "chase", durationMs: 6000 }
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

const plannedDirections = ["right", "right", "right", "right", "down", "down", "left"] as const;
const nextRandom = createDeterministicRandom([0.2, 0.8, 0.1, 0.6, 0.4, 0.9]);

for (const direction of plannedDirections) {
  state = requestDirectionForSession(state, direction);
  state = advanceGameSession(state, 500, nextRandom);

  console.log(
    renderBoardState({
      board: state.board,
      playerPosition: state.player.position,
      collectibles: state.collectibles,
      enemies: state.enemies,
      status: state.status,
      score: state.score.value,
      lives: state.lives.value
    })
  );
  console.log("");

  if (state.status !== "running") {
    state = advanceGameSession(state, 1000, nextRandom);

    console.log(
      renderBoardState({
        board: state.board,
        playerPosition: state.player.position,
        collectibles: state.collectibles,
        enemies: state.enemies,
        status: state.status,
        score: state.score.value,
        lives: state.lives.value
      })
    );
    console.log("");

    break;
  }
}

state = pauseGameSession(state);
console.log(
  renderBoardState({
    board: state.board,
    playerPosition: state.player.position,
    collectibles: state.collectibles,
    enemies: state.enemies,
    status: state.status,
    score: state.score.value,
    lives: state.lives.value
  })
);
console.log("");

state = resumeGameSession(state);
state = restartGameSession(state);
console.log(
  renderBoardState({
    board: state.board,
    playerPosition: state.player.position,
    collectibles: state.collectibles,
    enemies: state.enemies,
    status: state.status,
    score: state.score.value,
    lives: state.lives.value
  })
);
