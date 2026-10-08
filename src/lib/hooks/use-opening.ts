import { useState } from "react";

/**
 * Open state for a dialog or panel that keeps its last value until the next opening, so it doesn't
 * empty while animating closed. `key` changes on each opening: keyed content starts afresh.
 */
export function useOpening<T>(initial: T) {
  const [state, setState] = useState({ open: false, value: initial, key: 0 });
  return {
    ...state,
    show: (value: T) => setState((current) => ({ open: true, value, key: current.key + 1 })),
    hide: () => setState((current) => ({ ...current, open: false })),
  };
}
