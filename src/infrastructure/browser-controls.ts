import type { Direction } from "../domain/value-objects.js";

export type BrowserControlsCommands = Readonly<{
  requestDirection: (direction: Direction) => void;
  start: () => void;
  togglePause: () => void;
  restart: () => void;
  toggleDebug: () => void;
}>;

export const dispatchBrowserControl = (command: string, commands: BrowserControlsCommands): boolean => {
  switch (command) {
    case "up": case "down": case "left": case "right":
      commands.requestDirection(command);
      return true;
    case "start": commands.start(); return true;
    case "pause": commands.togglePause(); return true;
    case "restart": commands.restart(); return true;
    case "debug": commands.toggleDebug(); return true;
    default: return false;
  }
};

export const bindBrowserControls = (root: HTMLElement, commands: BrowserControlsCommands): (() => void) => {
  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("button[data-command]");
    if (button === null || !root.contains(button) || button.disabled) {
      return;
    }

    dispatchBrowserControl(button.dataset.command ?? "", commands);
  };

  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
};
