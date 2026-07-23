import { createBoard, type LevelDefinition } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import {
  advanceGameSession,
  createGameSession,
  requestDirectionForSession,
  startGameSession
} from "../application/game-session.js";
import { renderBoardState } from "../presentation/console.js";

const DEMO_LEVEL: LevelDefinition = {
  id: "console-demo",
  rows: [
    "#########",
    "#P......#",
    "#.###.#.#",
    "#...T...#",
    "#.###.#.#",
    "#E.....E#",
    "#########"
  ]
};

let state = startGameSession(
  createGameSession(createBoard(DEMO_LEVEL), {
    playerSpeedUnitsPerSecond: 2,
    enemySpeedUnitsPerSecond: 2,
    initialLives: 3,
    scoring: {
      dotPoints: 10,
      powerPelletPoints: 50
    }
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
    break;
  }
}
