"use client";

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MB } from "@/lib/api/media";
import type { UploadState } from "@/lib/hooks/use-upload";
import { StatusPanel } from "./status-panel";

/** Progress of a direct upload; nothing when idle. */
export function UploadProgress({ state, onCancel, onRetry }: { state: UploadState; onCancel: () => void; onRetry?: () => void }) {
  if (state.phase === "uploading") {
    return (
      <StatusPanel>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Subiendo… {state.progress}%</span>
          <span className="text-xs text-muted-foreground">
            {(state.loaded / MB).toFixed(1)} de {(state.total / MB).toFixed(1)} MB
          </span>
        </div>
        <Progress value={state.progress} />
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
