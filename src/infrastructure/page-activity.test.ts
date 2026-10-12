import { describe, expect, it, vi } from "vitest";
import { bindPageActivity } from "./page-activity.js";

class Page extends EventTarget {
  hidden = false;
  focused = true;
  hasFocus = (): boolean => this.focused;
}

describe("page activity", () => {
  it("reports initial activity, backgrounding and returning to the window", () => {
    const page = new Page();
    const windowEvents = new EventTarget();
    const change = vi.fn();
    bindPageActivity(page, windowEvents, change);
    expect(change).toHaveBeenLastCalledWith(true);
    windowEvents.dispatchEvent(new Event("blur"));
    expect(change).toHaveBeenLastCalledWith(false);
    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    windowEvents.dispatchEvent(new Event("focus"));
    expect(change).toHaveBeenLastCalledWith(false);
    page.hidden = false;
    page.focused = false;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(change).toHaveBeenLastCalledWith(false);
    page.focused = true;
    windowEvents.dispatchEvent(new Event("focus"));
    expect(change).toHaveBeenLastCalledWith(true);
  });

  it("removes page and window listeners when detached", () => {
    const page = new Page();
    const windowEvents = new EventTarget();
    const change = vi.fn();
    const unbind = bindPageActivity(page, windowEvents, change);
    unbind();
    page.dispatchEvent(new Event("visibilitychange"));
    windowEvents.dispatchEvent(new Event("blur"));
    windowEvents.dispatchEvent(new Event("focus"));
    expect(change).toHaveBeenCalledTimes(1);
  });
});
