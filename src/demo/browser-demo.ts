import { startBrowserDemo } from "../presentation/browser.js";
import { createBrowserStorageScoreRepository } from "../infrastructure/score-repositories.js";
import { DEMO_LEVEL } from "./demo-level.js";

const root = document.getElementById("app");

if (root === null) {
  throw new Error("Browser demo root element was not found.");
}

startBrowserDemo({
  root,
  level: DEMO_LEVEL,
  playerName: "andersonNB",
  scoreRepository: createBrowserStorageScoreRepository(window.localStorage),
  sessionConfig: {
    playerSpeedUnitsPerSecond: 3.2,
    enemySpeedUnitsPerSecond: 2.4,
    frightenedDurationMs: 4000,
    enemyReleaseScheduleMs: [2000, 4000, 4000],
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
      fruitPoints: 100,
      enemyPoints: 200
    },
    respawnDelayMs: 1000,
    levelCompletedDelayMs: 1000
  }
});
