import { describe, expect, it, vi } from "vitest";
import { bindSwipeInput, resolveSwipeDirection } from "./swipe-input.js";

class SwipeSurface extends EventTarget {
  style = { touchAction: "pan-y" };
  private capturedPointer: number | null = null;
  setPointerCapture(id: number): void { this.capturedPointer = id; }
  hasPointerCapture(id: number): boolean { return this.capturedPointer === id; }
  releasePointerCapture(): void { this.capturedPointer = null; }
}

const pointer = (type: string, overrides: Partial<PointerEvent> = {}): Event =>
  Object.assign(new Event(type), {
    pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 100, clientY: 100,
    ...overrides
  });

describe("swipe direction", () => {
  it.each([
    [40, 3, "right"], [-40, 3, "left"], [3, 40, "down"], [3, -40, "up"]
  ] as const)("resolves displacement (%s, %s) as %s", (x, y, direction) => {
    expect(resolveSwipeDirection({ x: 100, y: 100 }, { x: 100 + x, y: 100 + y })).toBe(direction);
  });

  it("ignores taps, small movements, ambiguous diagonals and invalid coordinates", () => {
    const start = { x: 0, y: 0 };
    for (const end of [{ x: 0, y: 0 }, { x: 23, y: 0 }, { x: 40, y: 40 }, { x: NaN, y: 40 }]) {
      expect(resolveSwipeDirection(start, end)).toBeNull();
    }
    expect(resolveSwipeDirection(start, { x: 24, y: 0 })).toBe("right");
  });
});

describe("swipe pointer adapter", () => {
  const setup = () => {
    const surface = new SwipeSurface();
    const requestDirection = vi.fn();
    const unbind = bindSwipeInput(surface as unknown as HTMLElement, requestDirection);
    return { surface, requestDirection, unbind };
  };

  it("captures a gesture and emits one command only for its matching pointer", () => {
    const { surface, requestDirection } = setup();
    surface.dispatchEvent(pointer("pointerdown"));
    expect(surface.hasPointerCapture(1)).toBe(true);
    surface.dispatchEvent(pointer("pointerup", { pointerId: 2, clientX: 150 }));
    expect(requestDirection).not.toHaveBeenCalled();
    surface.dispatchEvent(pointer("pointerup", { clientX: 150 }));
    surface.dispatchEvent(pointer("pointerup", { clientX: 160 }));
    expect(requestDirection).toHaveBeenCalledTimes(1);
    expect(requestDirection).toHaveBeenCalledWith("right");
    expect(surface.hasPointerCapture(1)).toBe(false);
  });

  it("ignores mouse and secondary pointers and cancels interrupted gestures", () => {
    const { surface, requestDirection } = setup();
    for (const overrides of [{ pointerType: "mouse" }, { isPrimary: false }]) {
      surface.dispatchEvent(pointer("pointerdown", overrides));
      surface.dispatchEvent(pointer("pointerup", { clientX: 150 }));
    }
    for (const cancellation of ["pointercancel", "lostpointercapture"]) {
      surface.dispatchEvent(pointer("pointerdown"));
      surface.dispatchEvent(pointer(cancellation));
      surface.dispatchEvent(pointer("pointerup", { clientX: 150 }));
    }
    expect(requestDirection).not.toHaveBeenCalled();
  });

  it("restores scrolling and removes listeners when detached", () => {
    const { surface, requestDirection, unbind } = setup();
    expect(surface.style.touchAction).toBe("none");
    surface.dispatchEvent(pointer("pointerdown"));
    unbind();
    expect(surface.style.touchAction).toBe("pan-y");
    expect(surface.hasPointerCapture(1)).toBe(false);
    surface.dispatchEvent(pointer("pointerdown"));
    surface.dispatchEvent(pointer("pointerup", { clientX: 150 }));
    expect(requestDirection).not.toHaveBeenCalled();
  });
});
