"use client";

import { type KeyboardEvent, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { IssueSeverity, ReviewFrame, ReviewIssue } from "@/lib/api/types";
import { formatDuration, plural, twoDigits } from "@/lib/format";
import { useStableUrl } from "@/lib/hooks/use-stable-url";
import { cn } from "@/lib/utils";
import { CATEGORIES, FRAME_KINDS, ISSUE_STATUSES, isOpen, SEVERITIES } from "./qa";

// The frames a review looked at: a grid of them, and one enlarged with what was found drawn over it.

const BOX_TONES: Record<IssueSeverity, { border: string; tag: string }> = {
  critical: { border: "border-destructive", tag: "bg-destructive" },
  major: { border: "border-warning", tag: "bg-warning" },
  minor: { border: "border-accent", tag: "bg-accent" },
};

/** A fraction of the frame as a CSS percentage (to a hundredth: 0.98 − 0.55 is 42.99999…). */
const percent = (fraction: number) => `${Math.round(Math.min(1, Math.max(0, fraction)) * 10_000) / 100}%`;

/** "Escena 02" (where the review's numbering knows the scene). */
export const sceneLabel = (sceneId: string | null, numbers: Map<string, number>) => {
  const number = sceneId ? numbers.get(sceneId) : undefined;
  return number ? `Escena ${twoDigits(number)}` : null;
};

/** The findings seen on this frame. */
export const issuesOn = (frame: ReviewFrame, issues: ReviewIssue[]) =>
  issues.filter((issue) => issue.frame_index === frame.index);

/** A finding no longer open: dismissed or fixed. */
export function IssueStatusBadge({ issue }: { issue: ReviewIssue }) {
  const status = ISSUE_STATUSES[issue.status];
  return status && <Badge variant={status.variant}>{status.label}</Badge>;
}

interface FrameImageProps {
  frame: ReviewFrame;
  /** Findings drawn over it, where they were seen (each numbered, when `numbered`). */
  issues: ReviewIssue[];
  numbered?: boolean;
  /** Said by screen readers; empty when what holds it says it. */
  alt?: string;
  className?: string;
}

/** A frame of the video (960 × 540), with a box over each place where something was found. */
export function FrameImage({ frame, issues, numbered = false, alt = "", className }: FrameImageProps) {
  // Each poll signs its link again: the same picture isn't downloaded again.
  const url = useStableUrl(frame.url);
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-ink-900", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-white/50">
          <ImageOff className="h-5 w-5" aria-hidden />
          <span className="sr-only">{alt || "Sin imagen"}</span>
        </span>
      )}
      {issues.map((issue, position) => {
        if (!issue.box) return null;
        const [left, top, right, bottom] = issue.box;
        const tone = BOX_TONES[issue.severity];
        return (
          <span
            key={issue.id}
            aria-hidden
            data-qa-box={issue.id}
            className={cn("absolute border-2", tone.border, !isOpen(issue) && "border-dashed opacity-60")}
            style={{ left: percent(left), top: percent(top), width: percent(right - left), height: percent(bottom - top) }}
          >
            {numbered && (
              <span className={cn("absolute left-0 top-0 px-1 text-[10px] font-bold leading-4 text-white", tone.tag)}>
                {position + 1}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

interface FrameGridProps {
  frames: ReviewFrame[];
  issues: ReviewIssue[];
  numbers: Map<string, number>;
  /** Enlarges the frame (its place in `frames`). */
  onOpen: (position: number) => void;
}

/** Every frame the review looked at, in the video's order: two side by side on a phone, four on a wider screen. */
export function FrameGrid({ frames, issues, numbers, onOpen }: FrameGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {frames.map((frame, position) => {
        const open = issuesOn(frame, issues).filter(isOpen);
        const scene = sceneLabel(frame.scene_id, numbers);
        const name = [
          `Fotograma del ${formatDuration(frame.at_seconds)}`,
          scene?.toLowerCase(),
          open.length ? plural(open.length, "hallazgo") : null,
        ]
          .filter(Boolean)
          .join(", ");
        return (
          <li key={frame.index} className="min-w-0">
            <button
              type="button"
              onClick={() => onOpen(position)}
              aria-label={name}
              className="group relative block w-full text-left"
            >
              <FrameImage frame={frame} issues={open} className="transition-opacity group-hover:opacity-90" />
              {open.length > 0 && (
                <span className="absolute right-1 top-1">
                  <Badge variant={open.some((issue) => issue.severity === "critical") ? "destructive" : "warning"}>
                    <AlertTriangle className="h-3 w-3" aria-hidden /> {open.length}
                  </Badge>
                </span>
              )}
              <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{formatDuration(frame.at_seconds)}</span>
                {scene && <span className="truncate">{scene}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface FrameDialogProps {
  frames: ReviewFrame[];
  issues: ReviewIssue[];
  numbers: Map<string, number>;
  /** The frame shown (its place in `frames`); null: closed. */
  position: number | null;
  onPositionChange: (position: number | null) => void;
}

/** One frame enlarged, with each finding drawn where it was seen and listed under it; the others one tap away. */
export function FrameDialog({ frames, issues, numbers, position, onPositionChange }: FrameDialogProps) {
  // The last frame shown stays while the dialog closes (it fades out with it).
  const [shown, setShown] = useState(position);
  if (position !== null && position !== shown) setShown(position);
  const frame = shown === null ? null : (frames[shown] ?? null);
  const step = (by: number) => {
    if (position === null || !frames.length) return;
    onPositionChange((position + by + frames.length) % frames.length); // past the last one, the first
  };
  const arrows = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
  };
  const found = frame ? issuesOn(frame, issues) : [];
  // Those drawn on it first, numbered as on the picture.
  const listed = [...found.filter((issue) => issue.box), ...found.filter((issue) => !issue.box)];
  const scene = frame ? sceneLabel(frame.scene_id, numbers) : null;
  const title = frame ? [scene, formatDuration(frame.at_seconds)].filter(Boolean).join(" · ") : "";
  return (
    <Dialog open={position !== null && frame !== null} onOpenChange={(open) => !open && onPositionChange(null)}>
      <DialogContent className="max-w-4xl" onKeyDown={arrows}>
        {frame && (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {FRAME_KINDS[frame.kind]} · {found.length ? plural(found.length, "hallazgo") : "Sin hallazgos"}
              </DialogDescription>
            </DialogHeader>
            <FrameImage frame={frame} issues={listed} numbered alt={`Fotograma: ${title}`} />
            {listed.length > 0 && (
              <ol className="mt-4 space-y-2" aria-label="Lo que se encontró en el fotograma">
                {listed.map((issue, index) => (
                  <li key={issue.id} className="flex gap-3 text-sm">
                    <span className="w-5 shrink-0 font-display text-base font-medium text-accent">
                      {issue.box ? index + 1 : "·"}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge variant={SEVERITIES[issue.severity].variant}>{SEVERITIES[issue.severity].label}</Badge>
                        <span className="font-semibold">{CATEGORIES[issue.category]}</span>
                        <IssueStatusBadge issue={issue} />
                      </p>
                      <p className="break-words">{issue.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {/* On a phone only their arrows fit (their names say it all). */}
            {frames.length > 1 && (
              <div className="mt-6 flex items-center justify-between gap-3">
                <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label="Fotograma anterior">
                  <ChevronLeft /> <span className="hidden sm:inline">Anterior</span>
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {(position ?? 0) + 1} de {frames.length}
                </span>
                <Button variant="outline" size="sm" onClick={() => step(1)} aria-label="Fotograma siguiente">
                  <span className="hidden sm:inline">Siguiente</span> <ChevronRight />
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
