import { Check, Lock } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { AssignmentSource, JourneyStatus, PathPerson, PathStatus, StepStatus } from "@/lib/api/types";
import { formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StatusStyle {
  label: string;
  variant: BadgeProps["variant"];
}

// Path badges also sit over the dark header, hence `inverse` for archived (as courses).
const PATH_STATUS: Record<PathStatus, StatusStyle> = {
  published: { label: "Publicada", variant: "success" },
  draft: { label: "Borrador", variant: "secondary" },
  archived: { label: "Archivada", variant: "inverse" },
};

const JOURNEY_STATUS: Record<JourneyStatus, StatusStyle> = {
  not_started: { label: "Sin empezar", variant: "secondary" },
  in_progress: { label: "En curso", variant: "accent" },
  completed: { label: "Completada", variant: "success" },
  overdue: { label: "Vencida", variant: "destructive" },
};

export function PathStatusBadge({ status }: { status: PathStatus }) {
  const { label, variant } = PATH_STATUS[status] ?? PATH_STATUS.draft;
  return <Badge variant={variant}>{label}</Badge>;
}

/** How far a person is in a path: not started, in progress, completed or past its deadline. */
export function JourneyBadge({ status }: { status: JourneyStatus }) {
  const { label, variant } = JOURNEY_STATUS[status] ?? JOURNEY_STATUS.not_started;
  return <Badge variant={variant}>{label}</Badge>;
}

/** Whether the path came with the person's profile or was assigned by hand. */
export function SourceBadge({ source }: { source: AssignmentSource }) {
  return <Badge variant="outline">{source === "profile" ? "Por perfil" : "Manual"}</Badge>;
}

/** "Vence el 12 oct 2026", "Venció el…" (in red), "Completada el…", or "Sin plazo". Learners and admins read the same. */
export function Deadline({ journey }: { journey: Pick<PathPerson, "status" | "due_at" | "completed_at"> }) {
  const { status, due_at, completed_at } = journey;
  const text =
    status === "completed"
      ? `Completada el ${formatDate(completed_at)}`
      : !due_at
        ? "Sin plazo"
        : `${status === "overdue" ? "Venció" : "Vence"} el ${formatDate(due_at)}`;
  return <span className={cn("text-xs", status === "overdue" ? "font-semibold text-destructive" : "text-muted-foreground")}>{text}</span>;
}

const STEP_STYLE: Record<StepStatus, { label: string; className: string }> = {
  completed: { label: "Completado", className: "border-success bg-success text-white" },
  in_progress: { label: "En curso", className: "border-accent bg-accent text-white" },
  available: { label: "Disponible", className: "border-ink-800 bg-white text-ink-800" },
  locked: { label: "Bloqueado", className: "border-border bg-mist text-muted-foreground" },
};

const STEP_ORDER: StepStatus[] = ["completed", "in_progress", "available", "locked"];

/** A person's courses of the path, in order: one chip each, colored by how they go (see `StepLegend`). */
export function StepChips({ steps, titles, name }: { steps: PathPerson["steps"]; titles: Map<number, string>; name: string }) {
  if (!steps.length) return <p className="text-xs text-muted-foreground">Sin cursos publicados</p>;
  return (
    <ol className="flex flex-wrap gap-1" aria-label={`Cursos de ${name}`}>
      {steps.map((step, index) => {
        const style = STEP_STYLE[step.status];
        const progress = step.status === "in_progress" ? ` (${formatPercent(step.progress_pct)})` : "";
        return (
          <li
            key={step.course_id}
            className={cn("flex h-6 min-w-6 items-center justify-center border px-1 text-[11px] font-bold", style.className)}
          >
            {step.status === "completed" ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : step.status === "locked" ? (
              <Lock className="h-3 w-3" aria-hidden />
            ) : (
              <span aria-hidden>{index + 1}</span>
            )}
            <span className="sr-only">
              {`Curso ${index + 1}, «${titles.get(step.course_id) ?? ""}»: ${style.label.toLowerCase()}${progress}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** What each chip color says. */
export function StepLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground", className)} aria-label="Estado de cada curso">
      {STEP_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-3 border", STEP_STYLE[status].className)} aria-hidden />
          {STEP_STYLE[status].label}
        </li>
      ))}
    </ul>
  );
}
