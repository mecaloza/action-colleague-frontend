"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { revisionKeys, revisionsApi } from "@/lib/api/revisions";
import type { RevisionSource, RevisionStatus, RevisionSummary } from "@/lib/api/types";
import { formatDate, formatRelative } from "@/lib/format";

/** How each change came about. */
const SOURCES: Record<RevisionSource, string> = {
  observation: "Cambio pedido a la IA",
  qa: "Corrección de la revisión de calidad",
  manual: "Edición a mano",
  regenerate: "Reescritura con IA",
  revert: "Cambio deshecho",
};

const STATUSES: Record<RevisionStatus, { label: string; variant: BadgeProps["variant"] }> = {
  proposing: { label: "Preparando", variant: "secondary" },
  proposed: { label: "Por revisar", variant: "accent" },
  applied: { label: "Aplicado", variant: "success" },
  discarded: { label: "Descartado", variant: "outline" },
  failed: { label: "No se pudo", variant: "destructive" },
  superseded: { label: "Reemplazado", variant: "outline" },
  reverted: { label: "Deshecho", variant: "outline" },
};

export const isPendingRevision = (revision: Pick<RevisionSummary, "status">) =>
  revision.status === "proposing" || revision.status === "proposed";

interface RevisionHistoryProps {
  moduleId: number;
  /**
   * Why nothing can be undone now (the script has unsaved edits in the editor: undoing would replace them), as the
   * id of the text that says it; undefined when it can.
   */
  blockedBy?: string;
  /** Undoes an applied change; resolves once done (or failed: the toast says why). */
  onUndo: (revisionId: number) => Promise<unknown>;
  /** Opens a proposal still waiting for the admin's review. */
  onShow: (revisionId: number) => void;
}

/** Every change to the module's script, newest first: who made it, how and when; applied ones can be undone. */
export function RevisionHistory({ moduleId, blockedBy, onUndo, onShow }: RevisionHistoryProps) {
  const history = useQuery({
    queryKey: revisionKeys.list(moduleId),
    queryFn: () => revisionsApi.list(moduleId, "script"),
  });
  const [undoing, setUndoing] = useState<number | null>(null);
  if (history.isPending) return <Skeleton className="h-48" />;
  if (!history.data) return <QueryError query={history} />;
  if (!history.data.length) {
    return <p className="text-sm text-muted-foreground">Todavía no hay cambios en el guion de este módulo.</p>;
  }

  const undo = async (revisionId: number) => {
    setUndoing(revisionId);
    try {
      await onUndo(revisionId);
    } finally {
      setUndoing(null);
    }
  };

  return (
    <ol className="divide-y divide-border border border-border bg-white" aria-label="Cambios del guion">
      {history.data.map((revision) => {
        const status = STATUSES[revision.status] ?? { label: revision.status, variant: "outline" };
        const at = revision.applied_at ?? revision.created_at;
        const said = revision.observation.trim();
        const done = revision.summary.trim();
        return (
          <li key={revision.id} className="space-y-2 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 flex-1 basis-48 font-semibold">{SOURCES[revision.source] ?? revision.source}</p>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            {said && <p className="break-words text-sm">«{said}»</p>}
            {done && done !== said && <p className="break-words text-sm text-muted-foreground">{done}</p>}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-xs text-muted-foreground">
                {revision.created_by_name ?? "Sin autor"} ·{" "}
                <time dateTime={at ?? undefined} title={formatDate(at, true)}>
                  {formatRelative(at)}
                </time>
              </p>
              {revision.status === "applied" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void undo(revision.id)}
                  loading={undoing === revision.id}
                  disabled={Boolean(blockedBy) || (undoing !== null && undoing !== revision.id)}
                  aria-describedby={blockedBy}
                  aria-label={`Deshacer: ${done || said || SOURCES[revision.source]}`}
                >
                  <Undo2 /> Deshacer
                </Button>
              )}
              {isPendingRevision(revision) && (
                <Button variant="link" className="text-[13px]" onClick={() => onShow(revision.id)}>
                  {revision.status === "proposing" ? "Ver cómo va" : "Revisar la propuesta"}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
