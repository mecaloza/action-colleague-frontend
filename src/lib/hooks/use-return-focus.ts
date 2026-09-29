import { useRef } from "react";

type FocusEventHandler = (event: Event) => void;

/**
 * Radix dialogs return focus to their Trigger; ours often open from other places (a row, a menu,
 * a confirm() call). These handlers remember what had focus when the dialog opened and give it back
 * when it closes, so keyboard users continue where they were instead of at the top of the page.
 */
export function useReturnFocus(handlers: { onOpenAutoFocus?: FocusEventHandler; onCloseAutoFocus?: FocusEventHandler } = {}) {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
