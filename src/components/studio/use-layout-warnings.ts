"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { STUDIO_STALE_MS, studioApi, studioKeys } from "@/lib/api/studio";
import type { LayoutWarning, StoryboardDraft, StoryboardOut, StoryboardScene } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { inRenderSlot } from "./render-slots";

/** A draft is checked once it stops changing for this long (its slide's preview follows sooner). */
const LINT_DELAY_MS = 800;

/**
 * What the check looks at, as text: each scene's slide and visual, in order (where a scene is decides whether the
 * presenter is large on it). Never the narration: writing it asks for no check.
 */
const drawn = (scenes: StoryboardScene[]) =>
  JSON.stringify({ scenes: scenes.map(({ id, slide, visual }) => ({ id, slide, visual })) } satisfies StoryboardDraft);

export interface LayoutCheck {
  /** The server checks the slides (an older one sends no warnings with the script, and can't check a draft). */
  supported: boolean;
  /** The saved copy's warnings while the draft is that copy; otherwise the last ones found for the draft. */
  warnings: LayoutWarning[];
  /** A newer draft is being checked. */
  checking: boolean;
  /** The newest check failed: the warnings are an older draft's. */
  failed: boolean;
  retry: () => void;
}

/**
 * What doesn't fit or overlaps on the slides of the script being edited. The saved copy comes with its warnings; a
 * draft with other slides is checked by the server after a pause in the typing (a newer draft cancels the check of
 * the older one).
 */
export function useLayoutWarnings(moduleId: number, scenes: StoryboardScene[], saved: StoryboardOut): LayoutCheck {
  const live = useMemo(() => drawn(scenes), [scenes]);
  const savedCopy = useMemo(() => drawn(saved.scenes), [saved]);
  const draft = useDebouncedValue(live, LINT_DELAY_MS);
  const supported = saved.warnings !== undefined;
  const enabled = supported && live !== savedCopy && draft !== savedCopy;
  const check = useQuery({
    queryKey: studioKeys.storyboardLint(moduleId, draft),
    queryFn: ({ signal }) =>
      inRenderSlot(signal, () => studioApi.lintStoryboard(moduleId, JSON.parse(draft) as StoryboardDraft, signal)),
    enabled,
    staleTime: STUDIO_STALE_MS,
    gcTime: 60_000,
    // 429: the server is busy drawing other previews and checks: wait a bit longer each time.
    retry: (failures, error) => error instanceof ApiError && error.status === 429 && failures < 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  const latest = live === savedCopy ? saved.warnings : enabled ? check.data?.warnings : undefined;
  // The last warnings found stay on screen while the next draft is checked (and if that check fails).
  const [shown, setShown] = useState<LayoutWarning[]>(saved.warnings ?? []);
  if (latest && latest !== shown) setShown(latest);
  return {
    supported,
    warnings: latest ?? shown,
    checking: enabled && check.isFetching,
    failed: enabled && check.isError && !check.isFetching,
    retry: () => void check.refetch(),
  };
}
