import { describe, expect, it } from "vitest";

import { isLevelCompletionFlashFrame, resolveGhostFace } from "./browser.js";

describe("level completion presentation", () => {
  it("flashes only while the level completion transition is active", () => {
    expect(isLevelCompletionFlashFrame("levelCompleted", 0)).toBe(true);
    expect(isLevelCompletionFlashFrame("levelCompleted", 120)).toBe(false);
    expect(isLevelCompletionFlashFrame("victory", 0)).toBe(false);
    expect(isLevelCompletionFlashFrame("running", 240)).toBe(false);
  });
});

describe("ghost presentation", () => {
  it("uses the arcade frightened face unless the ghost is returning home", () => {
    expect(resolveGhostFace({ frightened: false, returningHome: false })).toBe("normal");
    expect(resolveGhostFace({ frightened: true, returningHome: false })).toBe("frightened");
    expect(resolveGhostFace({ frightened: true, returningHome: true })).toBe("eyes");
  });
});
