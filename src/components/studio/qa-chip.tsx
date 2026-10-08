"use client";

import { ScanEye, ScanSearch, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CourseDetail, ModuleAdmin } from "@/lib/api/types";
import { plural, twoDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  openReviewLabel,
  reviewable,
  type ReviewLook,
  reviewLook,
  type ReviewState,
  reviewState,
  type ReviewTone,
} from "./qa";

const TONE_ICONS: Record<ReviewTone, LucideIcon> = { pending: ScanEye, issues: ShieldAlert, clean: ShieldCheck };

interface ReviewBadgeLabelProps {
  look: ReviewLook;
  /** Between sm and md only its count (a row that doesn't wrap there needs the room for its title). */
  compact?: boolean;
}

/** The review's state as a badge (in a chip, a panel, a summary). */
export function ReviewBadgeLabel({ look, compact = false }: ReviewBadgeLabelProps) {
  const Icon = TONE_ICONS[look.tone];
  return (
    <Badge variant={look.variant} pulse={look.pulse}>
      {!look.pulse && <Icon className="h-3 w-3" aria-hidden />}
      {compact ? (
        <>
          <span className="sm:hidden md:inline">{look.label}</span>
          {look.count && <span className="hidden sm:inline md:hidden">{look.count}</span>}
        </>
      ) : (
        look.label
      )}
    </Badge>
  );
}

interface QaChipProps {
  module: ModuleAdmin;
  /** Opens the module's review ("Revisión de calidad"). */
  onOpen: () => void;
  compact?: boolean;
}

/**
 * The module's video review at a glance: a tap (or a click, or Enter) tells what it found and leads to it. Never a
 * tooltip: a phone has no hover.
 */
export function QaChip({ module, onOpen, compact = false }: QaChipProps) {
  const look = reviewLook(module.review);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="-my-2.5 inline-flex min-h-10 shrink-0 items-center"
        aria-label={`Revisión de calidad de ${module.title}: ${look.sentence}`}
      >
        <ReviewBadgeLabel look={look} compact={compact} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>
          <p className="text-[11px] font-bold uppercase tracking-label text-ink-700">Revisión de calidad</p>
          <p className="mt-1 text-sm">{look.sentence}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpen}>
          <ScanSearch /> {openReviewLabel(module.review)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** How the summary counts the videos in each state, in the order it says them. */
const STATE_WORDS: [ReviewState, string][] = [
  ["critical", "con problemas críticos"],
  ["issues", "con hallazgos por revisar"],
  ["reviewing", "en revisión"],
  ["failed", "sin poder revisarse"],
  ["unreviewed", "sin revisar"],
  ["clean", "sin pendientes"],
];

/** How many of the course's videos are in each state of their review, in a line. */
function countsLine(videos: ModuleAdmin[]): string {
  const states = videos.map((module) => reviewState(module.review));
  return STATE_WORDS.map(([state, words]) => [states.filter((each) => each === state).length, words] as const)
    .filter(([count]) => count > 0)
    .map(([count, words]) => `${plural(count, "video")} ${words}`)
    .join(" · ");
}

interface CourseQaSummaryProps {
  course: CourseDetail;
  onOpen: (moduleId: number) => void;
  /** Videos whose review is linked elsewhere already (a publish problem about it): left out of the list. */
  linked?: number[];
  /** On the dark band of the studio. */
  inverse?: boolean;
  className?: string;
}

/**
 * The reviews of the course's AI videos at a glance, with a way into each one that still has findings open. Nothing
 * while no video can have one.
 */
export function CourseQaSummary({ course, onOpen, linked = [], inverse = false, className }: CourseQaSummaryProps) {
  const videos = course.modules.filter(reviewable);
  if (!videos.length) return null;
  // Those with findings still open, the critical ones first.
  const waiting = (module: ModuleAdmin) => ["critical", "issues"].includes(reviewState(module.review));
  const pending = videos
    .filter((module) => waiting(module) && !linked.includes(module.id))
    .sort((a, b) => (b.review?.critical ?? 0) - (a.review?.critical ?? 0));
  return (
    <section aria-labelledby={`course-${course.id}-qa`} className={cn("space-y-2", className)}>
      <h3
        id={`course-${course.id}-qa`}
        className={cn(
          "flex items-center gap-2 text-[11px] font-bold uppercase tracking-label",
          inverse ? "text-white/60" : "text-ink-700",
        )}
      >
        <ShieldCheck className="h-4 w-4 text-accent" aria-hidden /> Revisión de calidad
      </h3>
      <p className={cn("text-sm", inverse ? "text-white/80" : "text-ink-800")}>{countsLine(videos)}.</p>
      {pending.length > 0 && (
        <ul className="space-y-1">
          {pending.map((module) => (
            <li key={module.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className={cn("min-w-0 break-words", inverse ? "text-white" : "text-ink-800")}>
                {twoDigits(module.order)} · {module.title}
              </span>
              <ReviewBadgeLabel look={reviewLook(module.review)} />
              <Button
                variant="link"
                className="text-[13px]"
                onClick={() => onOpen(module.id)}
                aria-label={`Ver la revisión de ${module.title}`}
              >
                Ver la revisión
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
