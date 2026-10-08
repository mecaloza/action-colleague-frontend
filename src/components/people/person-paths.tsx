import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { Deadline, JourneyBadge, SourceBadge } from "@/components/paths/path-badges";
import { Progress } from "@/components/ui/progress";
import type { LearnerPathStep, PersonPath } from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

/** What a step says under its title: how the person goes in it, or what unlocks it. */
function stepNote(step: LearnerPathStep, current: boolean): string {
  switch (step.status) {
    case "completed":
      return "Completado";
    case "locked":
      return step.locked_by ? `Se desbloquea al terminar «${step.locked_by.title}»` : "Bloqueado";
    case "in_progress":
      return `En curso · ${step.completed_modules} de ${plural(step.total_modules, "módulo")}`;
    default:
      return current ? "Su siguiente curso" : "Disponible";
  }
}

function Step({ step, index, current }: { step: LearnerPathStep; index: number; current: boolean }) {
  const locked = step.status === "locked";
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center border-2 font-display text-sm font-medium",
          step.status === "completed"
            ? "border-success bg-success text-white"
            : current
              ? "border-accent bg-accent text-white"
              : locked
                ? "border-border bg-mist text-muted-foreground"
                : "border-ink-800 bg-white text-ink-800",
        )}
        aria-hidden
      >
        {step.status === "completed" ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("break-words text-sm font-semibold", locked && "text-muted-foreground")}>
          <span className="sr-only">Curso {index + 1}: </span>
          {step.title}
        </p>
        <p className="text-xs text-muted-foreground">{stepNote(step, current)}</p>
      </div>
    </li>
  );
}

function PathCard({ path }: { path: PersonPath }) {
  const completed = path.steps.filter((step) => step.status === "completed").length;
  const titleId = `person-path-${path.id}`;
  return (
    <article className="border border-border bg-white" aria-labelledby={titleId}>
      <div className="space-y-3 border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <JourneyBadge status={path.status} />
          <SourceBadge source={path.source} />
          <Deadline journey={path} />
        </div>
        <h3 id={titleId} className="font-display text-xl font-medium leading-tight tracking-tightest">
          {/* Its people, with how each one goes. */}
          <Link href={`/admin/paths/${path.id}?tab=people`} className="-my-1 inline-block break-words py-1 hover:text-accent">
            {path.title}
          </Link>
        </h3>
        <div>
          <div className="flex items-center gap-3">
            <Progress value={path.progress_pct} className="flex-1" aria-label={`Avance en ${path.title}`} />
            <span className="w-10 text-right text-xs font-semibold">{formatPercent(path.progress_pct)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {completed} de {plural(path.steps.length, "curso")} completado{path.steps.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      {path.steps.length ? (
        <ol className="space-y-3 p-4 sm:p-5" aria-label={`Cursos de ${path.title}, en orden`}>
          {path.steps.map((step, index) => (
            <Step key={step.course_id} step={step} index={index} current={step.course_id === path.current_course_id} />
          ))}
        </ol>
      ) : (
        <p className="p-4 text-sm text-muted-foreground sm:p-5">Esta ruta aún no tiene cursos publicados.</p>
      )}
    </article>
  );
}

/** A person's learning paths, as they see them: progress, deadline and each course in order. */
export function PersonPaths({ paths }: { paths: PersonPath[] }) {
  if (!paths.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No tiene rutas de aprendizaje. Las recibe con su perfil o se le asignan desde cada ruta.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {paths.map((path) => (
        <li key={path.id}>
          <PathCard path={path} />
        </li>
      ))}
    </ul>
  );
}
