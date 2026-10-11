import type { Direction } from "../domain/value-objects.js";

type PointerPosition = Readonly<{ x: number; y: number }>;

const MIN_SWIPE_DISTANCE_PX = 24;
const AXIS_DOMINANCE_RATIO = 1.2;

export const resolveSwipeDirection = (start: PointerPosition, end: PointerPosition): Direction | null => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    return null;
  }

  const horizontalDistance = Math.abs(dx);
  const verticalDistance = Math.abs(dy);
  if (Math.max(horizontalDistance, verticalDistance) < MIN_SWIPE_DISTANCE_PX) {
    return null;
  }

  if (horizontalDistance >= verticalDistance * AXIS_DOMINANCE_RATIO) {
    return dx > 0 ? "right" : "left";
  }
  if (verticalDistance >= horizontalDistance * AXIS_DOMINANCE_RATIO) {
    return dy > 0 ? "down" : "up";
  }
  return null;
};

export const bindSwipeInput = (
  surface: HTMLElement,
  requestDirection: (direction: Direction) => void
): (() => void) => {
  let gesture: Readonly<{ pointerId: number; start: PointerPosition }> | null = null;
  const previousTouchAction = surface.style.touchAction;
  surface.style.touchAction = "none";

  const onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || (event.pointerType !== "touch" && event.pointerType !== "pen")) {
      return;
    }
    gesture = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY } };
    surface.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (gesture === null || gesture.pointerId !== event.pointerId) {
      return;
    }
    const direction = resolveSwipeDirection(gesture.start, { x: event.clientX, y: event.clientY });
    gesture = null;
    if (surface.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId);
    }
    if (direction !== null) {
      requestDirection(direction);
    }
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (gesture?.pointerId === event.pointerId) {
      gesture = null;
    }
  };

  surface.addEventListener("pointerdown", onPointerDown);
  surface.addEventListener("pointerup", onPointerUp);
  surface.addEventListener("pointercancel", onPointerCancel);
  surface.addEventListener("lostpointercapture", onPointerCancel);

  return () => {
    if (gesture !== null && surface.hasPointerCapture(gesture.pointerId)) {
      surface.releasePointerCapture(gesture.pointerId);
    }
    gesture = null;
    surface.removeEventListener("pointerdown", onPointerDown);
    surface.removeEventListener("pointerup", onPointerUp);
    surface.removeEventListener("pointercancel", onPointerCancel);
    surface.removeEventListener("lostpointercapture", onPointerCancel);
    surface.style.touchAction = previousTouchAction;
  };
};
