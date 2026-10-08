import { useRef } from "react";

type FocusEventHandler = (event: Event) => void;

/**
 * What has focus as a dialog opens. Inside a Radix menu that is the button that opened the menu
 * (the menu's `aria-labelledby`): the menu item itself disappears once the menu closes.
 */
function focusedOpener(): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  const menuTriggerId = active.closest('[role="menu"]')?.getAttribute("aria-labelledby");
  return (menuTriggerId && document.getElementById(menuTriggerId)) || active;
}

/**
 * Where the focus goes back to: what opened the dialog; if it is gone (its part of the page was drawn again while the
 * dialog was open), the control that took its id; otherwise the dialog's fallback.
 */
function returnTarget(opener: HTMLElement | null, fallback?: () => HTMLElement | null): HTMLElement | null {
  if (opener?.isConnected && opener !== document.body) return opener;
  const redrawn = opener?.id ? document.getElementById(opener.id) : null;
  return redrawn ?? fallback?.() ?? null;
}

interface ReturnFocusHandlers {
  onOpenAutoFocus?: FocusEventHandler;
  onCloseAutoFocus?: FocusEventHandler;
  /** Where the focus goes when what opened the dialog is gone as it closes (and nothing took its id). */
  fallback?: () => HTMLElement | null;
}

/**
 * Radix dialogs return focus to their Trigger; ours often open from other places (a row, a menu,
 * a confirm() call). These handlers remember what had focus when the dialog opened and give it back
 * when it closes, so keyboard users continue where they were instead of at the top of the page.
 * Radix skips the open event when focus is already inside the content, so dialogs that start on a
 * field focus it from their own `onOpenAutoFocus` (which runs after this capture), never `autoFocus`.
 */
export function useReturnFocus(handlers: ReturnFocusHandlers = {}) {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current = focusedOpener();
      handlers.onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      handlers.onCloseAutoFocus?.(event);
      const target = returnTarget(opener.current, handlers.fallback);
      opener.current = null; // each opening captures its own
      if (!event.defaultPrevented && target) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
