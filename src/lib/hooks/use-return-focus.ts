import { useRef, useState } from "react";

type FocusEventHandler = (event: Event) => void;

const activeElement = (): HTMLElement | null =>
  typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null;

/**
 * Radix dialogs return focus to their Trigger; ours often open from other places (a row, a menu,
 * a confirm() call). These handlers remember what had focus when the dialog opened and give it back
 * when it closes, so keyboard users continue where they were instead of at the top of the page.
 */
export function useReturnFocus(handlers: { onOpenAutoFocus?: FocusEventHandler; onCloseAutoFocus?: FocusEventHandler } = {}) {
  // Read when the content first renders (it mounts as the dialog opens), before an autoFocus field inside
  // takes the focus: then Radix skips its open event, which alone would never learn who opened it.
  const [focusedOnOpen] = useState(() => activeElement());
  const opener = useRef<HTMLElement | null>(focusedOnOpen);
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current = opener.current ?? activeElement();
      handlers.onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      handlers.onCloseAutoFocus?.(event);
      const target = opener.current;
      if (!event.defaultPrevented && target && target.isConnected && target !== document.body) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
