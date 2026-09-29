import { useCallback, useEffect, useRef } from "react";

/**
 * `signal()` is an AbortSignal that aborts when the component unmounts: work started with it (polling, a redirect
 * at the end) stops when the person leaves the page or the step.
 */
export function useUnmountSignal(): () => AbortSignal {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const current = new AbortController(); // one per mount: development mounts twice
    controller.current = current;
    return () => current.abort();
  }, []);
  return useCallback(() => controller.current!.signal, []); // called from handlers, after the effect ran
}
