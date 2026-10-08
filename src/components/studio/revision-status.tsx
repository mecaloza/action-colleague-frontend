"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ModuleAdmin } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isBusy } from "./steps";

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

/** A change the AI proposed (or is preparing) waits for the admin: a tap opens it. */
export function PendingChangeBadge({ module, onReview }: { module: ModuleAdmin; onReview: () => void }) {
  if (!module.revision_pending) return null;
  return (
    <button
      type="button"
      className="-my-2.5 inline-flex min-h-10 shrink-0 items-center"
      onClick={onReview}
      aria-label={`Cambio por revisar: abrir la propuesta de ${module.title}`}
    >
      <Badge variant="accent">Cambio por revisar</Badge>
    </button>
  );
}
