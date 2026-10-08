import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUnsavedChangesWarning } from "./use-unsaved-changes-warning";

/** A click that would leave this page for another one of the app (not a new tab, a download or another site). */
function leavingLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download")) {
    return null;
  }
  const url = new URL(link.href, window.location.href);
  const here = window.location;
  if (url.origin !== here.origin || (url.pathname === here.pathname && url.search === here.search)) return null;
  return link;
}

/**
 * While `dirty`: leaving by a link of the app (the menu, a back link) asks first with `ask`, and closing or reloading
 * the tab makes the browser ask. The click is held before anything sees it (so menus stay open meanwhile); once the
 * person agrees it is replayed, and goes where it was going.
 */
export function useLeaveGuard(dirty: boolean, ask: () => Promise<boolean>) {
  const router = useRouter();
  const askRef = useRef(ask);
  askRef.current = ask;
  const replaying = useRef(false);
  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (replaying.current) return;
      const link = leavingLink(event);
      if (!link) return;
      // On the window, while capturing: before React's handlers (Next's links navigate from those).
      event.preventDefault();
      event.stopPropagation();
      void askRef.current().then((leave) => {
        if (!leave) return;
        if (!link.isConnected) {
          const { pathname, search, hash } = new URL(link.href);
          router.push(`${pathname}${search}${hash}`);
          return;
        }
        replaying.current = true;
        try {
          link.click();
        } finally {
          replaying.current = false;
        }
      });
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [dirty, router]);
}
