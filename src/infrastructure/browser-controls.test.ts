import { describe, expect, it, vi } from "vitest";
import { dispatchBrowserControl } from "./browser-controls.js";

const createCommands = () => ({
  requestDirection: vi.fn(), start: vi.fn(), togglePause: vi.fn(),
  restart: vi.fn(), toggleDebug: vi.fn()
});

describe("browser control commands", () => {
  it("translates each direction into a direction request", () => {
    const commands = createCommands();
    for (const direction of ["up", "down", "left", "right"] as const) {
      expect(dispatchBrowserControl(direction, commands)).toBe(true);
      expect(commands.requestDirection).toHaveBeenLastCalledWith(direction);
    }
    expect(commands.start).not.toHaveBeenCalled();
  });

  it("dispatches lifecycle controls once and ignores unknown commands", () => {
    const commands = createCommands();
    for (const command of ["start", "pause", "restart", "debug"]) {
      expect(dispatchBrowserControl(command, commands)).toBe(true);
    }
    expect(dispatchBrowserControl("move-diagonally", commands)).toBe(false);
    expect(commands.start).toHaveBeenCalledTimes(1);
    expect(commands.togglePause).toHaveBeenCalledTimes(1);
    expect(commands.restart).toHaveBeenCalledTimes(1);
    expect(commands.toggleDebug).toHaveBeenCalledTimes(1);
    expect(commands.requestDirection).not.toHaveBeenCalled();
  });
});
