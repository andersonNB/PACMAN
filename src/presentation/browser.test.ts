import { describe, expect, it } from "vitest";

import { isLevelCompletionFlashFrame } from "./browser.js";

describe("level completion presentation", () => {
  it("flashes only while the level completion transition is active", () => {
    expect(isLevelCompletionFlashFrame("levelCompleted", 0)).toBe(true);
    expect(isLevelCompletionFlashFrame("levelCompleted", 120)).toBe(false);
    expect(isLevelCompletionFlashFrame("victory", 0)).toBe(false);
    expect(isLevelCompletionFlashFrame("running", 240)).toBe(false);
  });
});
