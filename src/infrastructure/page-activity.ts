export type PageActivitySource = EventTarget & Readonly<{
  hidden: boolean;
  hasFocus: () => boolean;
}>;

export const bindPageActivity = (
  page: PageActivitySource,
  windowEvents: EventTarget,
  onActivityChange: (active: boolean) => void
): (() => void) => {
  const onVisibilityChange = (): void => onActivityChange(!page.hidden && page.hasFocus());
  const onBlur = (): void => onActivityChange(false);
  const onFocus = (): void => onActivityChange(!page.hidden);

  page.addEventListener("visibilitychange", onVisibilityChange);
  windowEvents.addEventListener("blur", onBlur);
  windowEvents.addEventListener("focus", onFocus);
  onVisibilityChange();

  return () => {
    page.removeEventListener("visibilitychange", onVisibilityChange);
    windowEvents.removeEventListener("blur", onBlur);
    windowEvents.removeEventListener("focus", onFocus);
  };
};
