import { startBrowserDemo } from "../presentation/browser.js";
import { DEMO_LEVEL } from "./demo-level.js";

const root = document.getElementById("app");

if (root === null) {
  throw new Error("Browser demo root element was not found.");
}

startBrowserDemo({
  root,
  level: DEMO_LEVEL,
  sessionConfig: {
    playerSpeedUnitsPerSecond: 3.2,
    enemySpeedUnitsPerSecond: 2.4,
    initialLives: 3,
    scoring: {
      dotPoints: 10,
      powerPelletPoints: 50
    },
    respawnDelayMs: 1000,
    levelCompletedDelayMs: 1000
  }
});
