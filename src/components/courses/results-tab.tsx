"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { QueryError } from "@/components/layout/query-state";
import { Skeleton } from "@/components/ui/skeleton";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { CourseDetail, ModuleAnalytics } from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { questionTypeLabel } from "./question-model";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-1 text-[10.5px] font-bold uppercase tracking-label text-muted-foreground">{label}</dt>
      <dd className="font-display text-4xl font-medium tracking-tightest">{value}</dd>
    </div>
  );
}

function accuracyTone(accuracy: number | null) {
  if (accuracy === null) return "bg-fog";
  if (accuracy < 50) return "bg-destructive";
  if (accuracy < 75) return "bg-warning";
  return "bg-success";
}

/** Mean of the modules' average scores, leaving out modules nobody has been scored in yet. */
function overallAverage(modules: ModuleAnalytics[]): number | null {
  const scores = modules.map((m) => m.average_score).filter((score): score is number => score !== null);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

/** One module's numbers and its questions, hardest first. */
function ModuleResults({ module }: { module: ModuleAnalytics }) {
  const hardestFirst = [...module.questions].sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101));
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-display text-2xl font-medium tracking-tightest">{module.title}</h3>
        <p className="text-sm text-muted-foreground">
          {plural(module.learners, "persona")} · {plural(module.attempts, "intento")} · aprobación{" "}
          {formatPercent(module.pass_rate)}
          {module.average_score !== null ? ` · promedio ${formatPercent(module.average_score)}` : ""}
        </p>
      </div>
      <ol className="divide-y divide-border border border-border bg-white">
        {hardestFirst.map((question) => (
          <li key={question.question_id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_240px] md:items-center">
            <div>
              <p className="font-medium">{question.prompt}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {questionTypeLabel(question.type, { short: true })} · {plural(question.responses, "respuesta")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-fog">
                <div
                  className={cn("h-full rounded-full", accuracyTone(question.accuracy))}
                  style={{ width: `${question.accuracy ?? 0}%` }}
                />
              </div>
              <span className="w-12 text-right text-sm font-semibold">{formatPercent(question.accuracy)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ResultsTab({ course }: { course: CourseDetail }) {
  const analytics = useQuery({ queryKey: courseKeys.analytics(course.id), queryFn: () => coursesApi.analytics(course.id) });

  if (analytics.isLoading) return <Skeleton className="h-64" />;
  if (analytics.error) return <QueryError query={analytics} />;

  const modules = analytics.data?.modules ?? [];
  const totalAttempts = modules.reduce((sum, m) => sum + m.attempts, 0);
  if (totalAttempts === 0) {
    return (
      <EmptyState
        icon={<BarChart3 />}
        title="Aún no hay resultados"
        description="Cuando las personas presenten las evaluaciones verás aquí qué preguntas les cuestan más."
      />
    );
  }

  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 gap-8 border-y border-border py-8 md:grid-cols-4">
        <Stat label="Personas inscritas" value={String(course.enrolled_count)} />
        <Stat label="Completaron el curso" value={formatPercent(course.completion_rate)} />
        <Stat label="Intentos de evaluación" value={String(totalAttempts)} />
        <Stat label="Puntaje promedio" value={formatPercent(overallAverage(modules))} />
      </dl>

      {modules.map((module) => (
        <ModuleResults key={module.module_id} module={module} />
      ))}
    </div>
  );
}
