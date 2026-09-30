"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Job } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** What a background job is doing right now, with its progress. */
export function JobStatus({ job, fallback, className }: { job?: Job | null; fallback: string; className?: string }) {
  const progress = job?.progress ?? 0;
  return (
    <div role="status" aria-live="polite" className={cn("space-y-2", className)}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
        {job?.step || fallback}
      </p>
      {progress > 0 ? <Progress value={progress} /> : <Progress indeterminate />}
    </div>
  );
}

/** Why a module's script or video could not be produced. */
export function JobFailure({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

/** The step `useProposeOutline` is on (saving the brief, uploading, asking the AI), while the form waits. */
export function ProposeStatus({ status }: { status: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm font-semibold"
    >
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
      {status}…
    </p>
  );
}
