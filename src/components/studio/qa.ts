import type { BadgeProps } from "@/components/ui/badge";
import type {
  FrameKind,
  IssueCategory,
  IssueSeverity,
  IssueSource,
  IssueStatus,
  ModuleAdmin,
  ReviewBadge,
  ReviewIssue,
  VideoReview,
} from "@/lib/api/types";
import { plural } from "@/lib/format";
import { isBusy } from "./steps";

// The automatic review of a module's AI video ("Revisión de calidad"): how its state and its findings are told.

export const isReviewing = (review: Pick<ReviewBadge, "status"> | null | undefined) =>
  review?.status === "queued" || review?.status === "running";

/**
 * An AI module whose video has (or can have) a review: the server says so with `review` (null until there is one;
 * older servers leave it out). Not while it is being produced again: the new video comes with its own.
 */
export const reviewable = (module: ModuleAdmin) =>
  module.source === "ai" && Boolean(module.video) && module.review !== undefined && !isBusy(module);

export const SEVERITIES: Record<IssueSeverity, { label: string; many: string; variant: BadgeProps["variant"] }> = {
  critical: { label: "Crítico", many: "críticos", variant: "destructive" },
  major: { label: "Importante", many: "importantes", variant: "warning" },
  minor: { label: "Menor", many: "menores", variant: "secondary" },
};

/** What each finding is about, as the admin would say it. */
export const CATEGORIES: Record<IssueCategory, string> = {
  overlap: "Elementos encimados",
  cut_text: "Texto cortado",
  presenter_covers: "El presentador tapa algo",
  illegible: "Texto ilegible",
  garbled_text: "Texto con errores",
  empty: "Pantalla vacía",
  mismatch: "No coincide con el guion",
  content: "Contenido del guion",
  other: "Otro",
};

/** Who found it. */
export const SOURCES: Record<IssueSource, string> = {
  vision: "Lo vio la IA en los fotogramas",
  content: "Lo encontró la IA al leer el guion",
  lint: "Aviso de diseño de la diapositiva",
  video: "Revisión técnica del video",
};

/** How a finding no longer open is marked (an open one, not at all). */
export const ISSUE_STATUSES: Record<IssueStatus, { label: string; variant: BadgeProps["variant"] } | null> = {
  open: null,
  dismissed: { label: "Ignorado", variant: "outline" },
  fixed: { label: "Corregido", variant: "success" },
};

/** When each frame was taken. */
export const FRAME_KINDS: Record<FrameKind, string> = {
  settled: "La diapositiva de la escena, completa",
  scene: "Un momento al azar de la escena",
  random: "Un momento al azar del video",
};

const SEVERITY_ORDER: Record<IssueSeverity, number> = { critical: 0, major: 1, minor: 2 };

/** "Queda 1 hallazgo por revisar.", "Quedan 3 hallazgos por revisar, 1 de ellos crítico." */
export function pendingSentence(open: number, critical: number): string {
  const verb = open === 1 ? "Queda" : "Quedan";
  if (!critical) return `${verb} ${plural(open, "hallazgo")} por revisar.`;
  if (critical === open) return `${verb} ${plural(open, "problema crítico", "problemas críticos")} por corregir.`;
  const ofThem = critical === 1 ? "1 de ellos crítico" : `${critical} de ellos críticos`;
  return `${verb} ${plural(open, "hallazgo")} por revisar, ${ofThem}.`;
}

/** Where a video's review is, from the admin's side: what (if anything) waits for them. */
export type ReviewState = "unreviewed" | "reviewing" | "critical" | "issues" | "failed" | "clean";

export function reviewState(review: ReviewBadge | null): ReviewState {
  if (!review) return "unreviewed";
  if (isReviewing(review)) return "reviewing";
  if (review.critical) return "critical";
  if (review.open_issues) return "issues";
  return review.status === "error" ? "failed" : "clean";
}

export type ReviewTone = "pending" | "issues" | "clean";

/** How a module's review is shown at a glance. */
export interface ReviewLook {
  state: ReviewState;
  /** On its chip: short. */
  label: string;
  /** Where even that doesn't fit: how many are open ("" says it with the badge's color and icon alone). */
  count: string;
  /** What it means, whole: the chip's popover and its name for screen readers. */
  sentence: string;
  variant: BadgeProps["variant"];
  tone: ReviewTone;
  pulse?: boolean;
}

export function reviewLook(review: ReviewBadge | null): ReviewLook {
  const state = reviewState(review);
  const open = review?.open_issues ?? 0;
  const critical = review?.critical ?? 0;
  switch (state) {
    case "unreviewed":
      return {
        state,
        label: "Sin revisar",
        count: "",
        sentence: "Este video todavía no tiene revisión.",
        variant: "outline",
        tone: "pending",
      };
    case "reviewing":
      return {
        state,
        label: "Revisando",
        count: "",
        sentence: "La IA está revisando el video.",
        variant: "secondary",
        tone: "pending",
        pulse: true,
      };
    case "critical":
      return {
        state,
        label: plural(critical, "crítico"),
        count: String(critical),
        sentence: pendingSentence(open, critical),
        variant: "destructive",
        tone: "issues",
      };
    case "issues":
      return {
        state,
        label: plural(open, "hallazgo"),
        count: String(open),
        sentence: pendingSentence(open, 0),
        variant: "warning",
        tone: "issues",
      };
    case "failed":
      return {
        state,
        label: "Revisión fallida",
        count: "",
        sentence: "No se pudo completar la revisión del video.",
        variant: "warning",
        tone: "issues",
      };
    case "clean":
      return {
        state,
        count: "",
        variant: "success",
        tone: "clean",
        ...(review?.verdict === "ok"
          ? { label: "Sin problemas", sentence: "La revisión no encontró problemas." }
          : { label: "Sin pendientes", sentence: "Lo que encontró la revisión ya se corrigió o se ignoró." }),
      };
  }
}

/**
 * The scenes as the video shows them, numbered in its order: as its frames come, then (a scene no frame shows, found
 * by reading the script) as their findings come.
 */
export function sceneNumbers(review: VideoReview): Map<string, number> {
  const numbers = new Map<string, number>();
  const add = (sceneId: string | null) => {
    if (sceneId && !numbers.has(sceneId)) numbers.set(sceneId, numbers.size + 1);
  };
  [...review.frames].sort((a, b) => a.at_seconds - b.at_seconds).forEach((frame) => add(frame.scene_id));
  [...review.issues]
    .sort((a, b) => (a.at_seconds ?? Infinity) - (b.at_seconds ?? Infinity))
    .forEach((issue) => add(issue.scene_id));
  return numbers;
}

/** The findings about one scene (or, `sceneId` null, about the whole video). */
export interface IssueGroup {
  sceneId: string | null;
  issues: ReviewIssue[];
}

/**
 * The findings by scene, in the video's order (the whole video's last), the most serious first. Ignoring or fixing one
 * never moves it: what the admin is working on stays where it is.
 */
export function groupIssues(issues: ReviewIssue[], numbers: Map<string, number>): IssueGroup[] {
  const groups = new Map<string | null, ReviewIssue[]>();
  for (const issue of issues) groups.set(issue.scene_id, [...(groups.get(issue.scene_id) ?? []), issue]);
  const place = (sceneId: string | null) =>
    sceneId === null ? Infinity : (numbers.get(sceneId) ?? Number.MAX_SAFE_INTEGER);
  return Array.from(groups, ([sceneId, found]) => ({
    sceneId,
    issues: [...found].sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.at_seconds ?? Infinity) - (b.at_seconds ?? Infinity),
    ),
  })).sort((a, b) => place(a.sceneId) - place(b.sceneId));
}

/** "Encontró 3 hallazgos: 1 crítico, 1 importante y 1 menor." */
export function foundSentence(issues: ReviewIssue[]): string {
  if (!issues.length) return "No encontró nada por corregir.";
  const counts = (["critical", "major", "minor"] as const)
    .map((severity) => [severity, issues.filter((issue) => issue.severity === severity).length] as const)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => plural(count, SEVERITIES[severity].label.toLowerCase(), SEVERITIES[severity].many));
  const listed = counts.length > 1 ? `${counts.slice(0, -1).join(", ")} y ${counts[counts.length - 1]}` : counts[0];
  return `Encontró ${plural(issues.length, "hallazgo")}: ${listed}.`;
}

export const isOpen = (issue: ReviewIssue) => issue.status === "open";
