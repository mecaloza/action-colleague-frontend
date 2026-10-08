"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revisionKeys, revisionsApi } from "@/lib/api/revisions";
import type { ModuleAdmin, RevisionSummary, RevisionTarget } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isPendingRevision } from "./revision-history";
import { isBusy } from "./steps";

/** How many of the module's changes are read to find the ones still waiting (the newest ones; the API's most). */
const PENDING_LOOKUP = 200;

/**
 * The change the AI proposed (or is preparing) to the module's script, its quiz or one of its activities that waits
 * for the admin's review, if any. The module only says that some change waits: which one, its list says (read once
 * per module, for all of them).
 */
export function usePendingRevision(
  module: ModuleAdmin,
  target: RevisionTarget,
  activityId?: number,
): RevisionSummary | undefined {
  const waiting = Boolean(module.revision_pending);
  const pending = useQuery({
    queryKey: revisionKeys.pending(module.id),
    queryFn: () => revisionsApi.list(module.id, { limit: PENDING_LOOKUP }),
    enabled: waiting,
    select: (list) => list.filter(isPendingRevision),
  });
  if (!waiting) return undefined;
  return pending.data?.find(
    (revision) => revision.target === target && (target !== "activity" || revision.activity_id === activityId),
  );
}

/** How many scenes of its script the module's video doesn't show as they are now (0 while it is being produced). */
export function staleScenes(module: ModuleAdmin): number {
  if (!module.video || isBusy(module)) return 0;
  return module.stale_scene_ids?.length ?? 0;
}

interface StaleVideoNoticeProps {
  module: ModuleAdmin;
  /** Produces the video again; left out where the row already has its own button for it. */
  onProduce?: () => void;
  producing?: boolean;
  className?: string;
}

/** "El video no refleja 2 escenas — Volver a producir": the script changed since the video was made. */
export function StaleVideoNotice({ module, onProduce, producing = false, className }: StaleVideoNoticeProps) {
  const count = staleScenes(module);
  if (!count) return null;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-warning", className)}>
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span>El video no refleja {plural(count, "escena")} del guion</span>
      {onProduce && (
        <>
          <span aria-hidden>—</span>
          <Button
            variant="link"
            className="text-[13px]"
            onClick={onProduce}
            loading={producing}
            aria-label={`Volver a producir el video de ${module.title}`}
          >
            <RotateCcw /> Volver a producir
          </Button>
        </>
      )}
    </p>
  );
}

interface PendingChangeBadgeProps {
  module: ModuleAdmin;
  /** What the change is to: the module's script (left out), its quiz or one of its activities. */
  target?: RevisionTarget;
  activityId?: number;
  /** What it is known by, for screen readers ("la evaluación de …", an activity's title): the module's title. */
  name?: string;
  onReview: () => void;
}

/** A change the AI proposed (or is preparing) waits for the admin: a tap opens it. */
export function PendingChangeBadge({ module, target = "script", activityId, name, onReview }: PendingChangeBadgeProps) {
  if (!usePendingRevision(module, target, activityId)) return null;
  return (
    <button
      type="button"
      className="-my-2.5 inline-flex min-h-10 shrink-0 items-center"
      onClick={onReview}
      aria-label={`Cambio por revisar: abrir la propuesta de ${name ?? module.title}`}
    >
      <Badge variant="accent">Cambio por revisar</Badge>
    </button>
  );
}
