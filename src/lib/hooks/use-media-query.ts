import { useCallback, useSyncExternalStore } from "react";

/** Below Tailwind's `sm` (exactly where `sm:` styles don't apply): a phone. */
export const PHONE = "not all and (min-width: 640px)";
/** A device with only a finger (no mouse, no hover): the same query as Tailwind's `touch:` variant. */
export const TOUCH_ONLY = "(hover: none) and (pointer: coarse)";

/** Whether the media query matches right now (false where there is no window). */
export function matchesMedia(query: string): boolean {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

/** Whether the media query matches, kept up to date as the screen changes (false on the server). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
