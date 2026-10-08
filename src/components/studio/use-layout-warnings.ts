"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { STUDIO_STALE_MS, studioApi, studioKeys } from "@/lib/api/studio";
import type { LayoutWarning, Slide, StoryboardDraft, StoryboardOut, StoryboardScene } from "@/lib/api/types";
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

/** "points.2", "left.points.0", "chart_values.1": an item of one of the slide's lists, by its index. */
const LIST_ITEM = /^(.+)\.\d+$/;

/** What a slide has at a field's path ("left.points", "points.2"). */
const valueAt = (slide: Slide | undefined, path: string): unknown =>
  path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], slide);

/**
 * The warnings found on an earlier draft (`checked`, as JSON), where they still hold on `scenes`. One about an item of
 * a list stays next to it while the list keeps its length (its text is being edited) or the item is still there;
 * once items before it were removed, its index names another item: it goes to its scene as a whole (no field) until
 * the new draft is checked.
 */
function placed(warnings: LayoutWarning[], checked: string, scenes: StoryboardScene[]): LayoutWarning[] {
  const before = new Map((JSON.parse(checked) as StoryboardDraft).scenes.map((scene) => [scene.id, scene.slide]));
  const now = new Map(scenes.map((scene) => [scene.id, scene.slide]));
  return warnings.map((warning) => {
    const field = warning.field;
    const list = field?.match(LIST_ITEM)?.[1];
    if (!field || !list) return warning;
    const [was, is] = [before.get(warning.scene_id), now.get(warning.scene_id)];
    const length = (slide: Slide | undefined) => (valueAt(slide, list) as unknown[] | undefined)?.length;
    const holds = length(was) === length(is) || valueAt(was, field) === valueAt(is, field);
    return holds ? warning : { ...warning, field: null };
  });
}

/** Warnings, and the draft (as JSON) they were found on. */
interface Found {
  warnings: LayoutWarning[];
  on: string;
}

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
  /**
   * A picture of the script was just drawn (an infographic): what the presenter covers of it is known now, so the
   * scenes are checked again (the saved copy too: its warnings were found without it). Done when that check is.
   */
  recheck: () => Promise<void>;
}

/**
 * What doesn't fit or overlaps on the slides of the script being edited. The saved copy comes with its warnings; a
 * draft with other slides is checked by the server after a pause in the typing (a newer draft cancels the check of
 * the older one).
 */
export function useLayoutWarnings(moduleId: number, scenes: StoryboardScene[], saved: StoryboardOut): LayoutCheck {
  const queryClient = useQueryClient();
  const live = useMemo(() => drawn(scenes), [scenes]);
  const savedCopy = useMemo(() => drawn(saved.scenes), [saved]);
  const draft = useDebouncedValue(live, LINT_DELAY_MS);
  const supported = saved.warnings !== undefined;
  // The saved copy whose warnings were found before a picture drawn since (`recheck`): it is checked like a draft.
  const [outdated, setOutdated] = useState<StoryboardOut | null>(null);
  const ownWarnings = live === savedCopy && outdated !== saved;
  const enabled = supported && !ownWarnings && (draft !== savedCopy || outdated === saved);
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
  const latest: Found | undefined = ownWarnings
    ? saved.warnings && { warnings: saved.warnings, on: savedCopy }
    : enabled && check.data
      ? { warnings: check.data.warnings, on: draft }
      : undefined;
  // The last warnings found stay on screen while the next draft is checked (and if that check fails).
  const [shown, setShown] = useState<Found>({ warnings: saved.warnings ?? [], on: savedCopy });
  if (latest && latest.warnings !== shown.warnings) setShown(latest);
  const found = latest ?? shown;
  const warnings = useMemo(
    () => (found.on === live ? found.warnings : placed(found.warnings, found.on, scenes)),
    [found.warnings, found.on, live, scenes],
  );
  return {
    supported,
    warnings,
    checking: enabled && check.isFetching,
    failed: enabled && check.isError && !check.isFetching,
    retry: () => void check.refetch(),
    recheck: async () => {
      if (!supported) return;
      setOutdated(saved);
      // Every check made so far was made without the picture: none is used again.
      void queryClient.invalidateQueries({ queryKey: studioKeys.storyboardLints(moduleId), refetchType: "none" });
      await check.refetch(); // the draft on screen (or the saved copy), now
    },
  };
}
