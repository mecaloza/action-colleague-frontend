import { useState } from "react";

/** The URL without its query string: signed URLs of the same file differ only in the token. */
function fileOf(url: string): string {
  return url.split("?")[0];
}

/**
 * Signed media URLs change on every fetch (each poll signs them again). Keeps the first one while
 * it still points at the same file, so players don't restart and images aren't downloaded again.
 */
export function useStableUrl(url: string | null | undefined): string | null {
  const [stable, setStable] = useState(url ?? null);
  const next = url ?? null;
  if (next !== stable && (next === null || stable === null || fileOf(next) !== fileOf(stable))) {
    setStable(next); // a different file (or none): adopt it during render, React re-renders at once
    return next;
  }
  return stable;
}
