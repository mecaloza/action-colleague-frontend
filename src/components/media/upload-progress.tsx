"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MB } from "@/lib/api/media";
import type { UploadState } from "@/lib/hooks/use-upload";
import { StatusPanel } from "./status-panel";

const megabytes = new Intl.NumberFormat("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface UploadProgressProps {
  state: UploadState;
  onCancel: () => void;
  onRetry?: () => void;
}

/**
 * Progress of a direct upload; nothing when idle. Brought into view when the upload starts or fails:
 * below a tall panel it would be off screen, and its "Cancelar" may be the only way out while it uploads.
 */
export function UploadProgress(props: UploadProgressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { phase } = props.state;
  useEffect(() => {
    if (phase === "uploading" || phase === "error") ref.current?.scrollIntoView({ block: "nearest" });
  }, [phase]);
  return phase === "idle" ? null : <div ref={ref}><UploadStatus {...props} /></div>;
}

function UploadStatus({ state, onCancel, onRetry }: UploadProgressProps) {
  if (state.phase === "uploading") {
    return (
      <StatusPanel>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Subiendo… {state.progress}%</span>
          <span className="text-xs text-muted-foreground">
            {megabytes.format(state.loaded / MB)} de {megabytes.format(state.total / MB)} MB
          </span>
        </div>
        <Progress value={state.progress} aria-label="Progreso de la subida" />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X /> Cancelar
        </Button>
      </StatusPanel>
    );
  }
  if (state.phase === "finishing") {
    return (
      <StatusPanel>
        <p className="text-sm font-semibold">Archivo recibido. Preparando el procesamiento…</p>
        <Progress indeterminate />
      </StatusPanel>
    );
  }
  if (state.phase === "error") {
    return (
      <div role="alert" className="flex items-start gap-3 border-l-2 border-destructive bg-red-50 p-4 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="flex-1">
          <p>{state.message}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-2 text-[11px] font-bold uppercase tracking-label text-accent">
              Intentar de nuevo
            </button>
          )}
        </div>
      </div>
    );
  }
  return null;
}
