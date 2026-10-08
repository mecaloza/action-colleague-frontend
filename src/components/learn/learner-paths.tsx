import Link from "next/link";
import { Check, Lock, PlayCircle, Trophy } from "lucide-react";
import { JourneyBadge } from "@/components/paths/path-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { LearnerCourse, LearnerPath, LearnerPathStep } from "@/lib/api/types";
import { formatDate, formatPercent, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { courseHref } from "./learner-course-card";

/** "Vence el 12 oct 2026", "Venció el…", "Completada el…" (nothing without a deadline). */
function deadline(path: LearnerPath): string | null {
  if (path.status === "completed") return path.completed_at ? `Completada el ${formatDate(path.completed_at)}` : null;
  if (!path.due_at) return null;
  return `${path.status === "overdue" ? "Venció" : "Vence"} el ${formatDate(path.due_at)}`;
}

/** The line under a step's title: where the learner is in it, or what unlocks it. */
function stepNote(step: LearnerPathStep, current: boolean): string {
  switch (step.status) {
    case "completed":
      return "Completado";
    case "locked":
      return step.locked_by ? `Se desbloquea al terminar «${step.locked_by.title}»` : "Se desbloquea al terminar el curso anterior";
    case "in_progress":
      return `En curso · ${step.completed_modules} de ${plural(step.total_modules, "módulo")}`;
    default:
      return current ? "Tu siguiente curso" : "Disponible";
  }
}

function JourneyStep({ step, index, last, current }: { step: LearnerPathStep; index: number; last: boolean; current: boolean }) {
  const locked = step.status === "locked";
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* The rail: a line from this step down to the next one. */}
      {!last && <span className="absolute bottom-0 left-5 top-10 w-px -translate-x-1/2 bg-border" aria-hidden />}
      <span
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center border-2 font-display text-lg font-medium",
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
        {step.status === "completed" ? <Check className="h-5 w-5" /> : locked ? <Lock className="h-4 w-4" /> : index + 1}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        {/* A locked course is no link: it can't be opened yet. */}
        {locked ? (
          <p className="break-words font-semibold text-muted-foreground">
            <span className="sr-only">Curso {index + 1}, bloqueado: </span>
            {step.title}
          </p>
        ) : (
          <Link href={`/learn/${step.course_id}`} className="-my-2 inline-block break-words py-2 font-semibold hover:text-accent">
            <span className="sr-only">Curso {index + 1}: </span>
            {step.title}
          </Link>
        )}
        <p className="mt-0.5 text-sm text-muted-foreground">{stepNote(step, current)}</p>
        {current && (
          <Badge variant="accent" className="mt-2">
            Sigue aquí
          </Badge>
        )}
      </div>
    </li>
  );
}

/** One of the learner's paths: progress, deadline, its courses in order and the course to go on with. */
function PathJourney({ path, courses }: { path: LearnerPath; courses: LearnerCourse[] }) {
  const current = path.steps.find((step) => step.course_id === path.current_course_id) ?? null;
  const completed = path.steps.filter((step) => step.status === "completed").length;
  const due = deadline(path);
  // The module to resume, as the course cards do.
  const nextModule = courses.find((course) => course.course_id === current?.course_id)?.next_module_id ?? null;
  const titleId = `learner-path-${path.id}`;
  return (
    <article className="flex flex-col border border-border bg-white" aria-labelledby={titleId}>
      <div className="space-y-4 border-b border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <JourneyBadge status={path.status} />
          {due && (
            <span className={cn("text-xs", path.status === "overdue" ? "font-semibold text-destructive" : "text-muted-foreground")}>
              {due}
            </span>
          )}
        </div>
        <div>
          <p className="eyebrow mb-2">Ruta de aprendizaje</p>
          <h3 id={titleId} className="break-words font-display text-2xl font-medium leading-tight tracking-tightest">
            {path.title}
          </h3>
          {path.description && <p className="mt-2 break-words text-sm text-muted-foreground">{path.description}</p>}
        </div>
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
      <ol className="p-5 sm:p-6" aria-label={`Cursos de ${path.title}, en orden`}>
        {path.steps.map((step, index) => (
          <JourneyStep
            key={step.course_id}
            step={step}
            index={index}
            last={index === path.steps.length - 1}
            current={step.course_id === current?.course_id}
          />
        ))}
        {!path.steps.length && <li className="text-sm text-muted-foreground">Esta ruta aún no tiene cursos publicados.</li>}
      </ol>
      {(current || path.status === "completed") && (
        <div className="mt-auto border-t border-border p-5 sm:p-6">
          {current ? (
            // A long title wraps inside the button instead of widening the page.
            <Button variant="accent" size="lg" className="h-auto min-h-12 w-full whitespace-normal py-3 sm:w-auto" asChild>
              <Link href={courseHref({ course_id: current.course_id, next_module_id: nextModule })}>
                <PlayCircle /> {path.status === "not_started" ? "Empezar" : "Continuar"}: {current.title}
              </Link>
            </Button>
          ) : (
            <p className="flex items-center gap-2 font-semibold text-success">
              <Trophy className="h-5 w-5" aria-hidden /> ¡Completaste la ruta!
            </p>
          )}
        </div>
      )}
    </article>
  );
}

/** "Mi ruta": the learner's paths, first thing on their page. */
export function MyPaths({ paths, courses }: { paths: LearnerPath[]; courses: LearnerCourse[] }) {
  return (
    <section aria-labelledby="my-paths">
      <h2 id="my-paths" className="mb-6 flex items-baseline gap-3 font-display text-3xl font-medium tracking-tightest">
        {paths.length === 1 ? "Mi ruta" : "Mis rutas"}
        {paths.length > 1 && <span className="text-base font-normal text-muted-foreground">{paths.length}</span>}
      </h2>
      <div className={paths.length === 1 ? "max-w-3xl" : "grid gap-6 lg:grid-cols-2"}>
        {paths.map((path) => (
          <PathJourney key={path.id} path={path} courses={courses} />
        ))}
      </div>
    </section>
  );
}
