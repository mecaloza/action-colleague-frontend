"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { NewCourseButton } from "@/components/courses/new-course-button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { QueryError } from "@/components/layout/query-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { dashboardApi, dashboardKeys } from "@/lib/api/dashboard";
import type { Dashboard } from "@/lib/api/types";
import { formatPercent, formatRelative, plural, twoDigits } from "@/lib/format";

function Kpi({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="border-l border-white/15 pl-6 first:border-l-0 first:pl-0">
      <p className="font-display text-5xl font-medium tracking-tightest text-white">{value}</p>
      <p className="mt-2 text-[10.5px] font-bold uppercase tracking-label text-white/60">{label}</p>
      {hint && <p className="mt-1 text-xs text-white/60">{hint}</p>}
    </div>
  );
}

const ACTIVITY_TEXT = {
  passed_quiz: "aprobó la evaluación de",
  failed_quiz: "no aprobó la evaluación de",
  completed_course: "completó el curso",
} as const;

type Activity = Dashboard["recent_activity"][number];

function ActivityItem({ item }: { item: Activity }) {
  const showScore = item.score !== null && item.kind !== "completed_course";
  return (
    <li className="flex items-start gap-4 px-5 py-4">
      {item.kind === "failed_quiz" ? (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p>
          <span className="font-semibold">{item.user_name}</span> {ACTIVITY_TEXT[item.kind]}{" "}
          <Link href={`/admin/courses/${item.course_id}`} className="font-semibold hover:text-accent">
            {item.module_title ?? item.course_title}
          </Link>
          {showScore ? ` (${formatPercent(item.score)})` : ""}
        </p>
        {item.module_title && <p className="text-xs text-muted-foreground">{item.course_title}</p>}
      </div>
      {item.at && <time className="shrink-0 text-xs text-muted-foreground">{formatRelative(item.at)}</time>}
    </li>
  );
}

function TopCourseItem({ course, rank }: { course: Dashboard["top_courses"][number]; rank: number }) {
  return (
    <li>
      <Link
        href={`/admin/courses/${course.id}`}
        className="group block border border-border bg-white p-5 transition-colors hover:border-ink-800"
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="font-display text-2xl font-medium text-accent">{twoDigits(rank)}</span>
          <p className="flex-1 font-semibold group-hover:text-accent">{course.title}</p>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </div>
        <div className="flex items-center gap-3">
          <Progress value={course.completion_rate} className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {formatPercent(course.completion_rate)} de {plural(course.enrolled_count, "persona")}
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const dashboard = useQuery({ queryKey: dashboardKeys.all, queryFn: dashboardApi.get, refetchInterval: 30_000 });
  const data = dashboard.data;

  return (
    <>
      <PageHero
        eyebrow="Panel"
        title={`Hola, ${user?.name.split(" ")[0] ?? ""}`.trim()}
        description="Así va la formación de tu equipo."
        actions={<NewCourseButton size="lg" />}
      >
        {data ? (
          <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <Kpi value={String(data.courses.published)} label="Cursos publicados" hint={`${data.courses.draft} en borrador`} />
            <Kpi
              value={String(data.learners.active_30d)}
              label="Personas activas (30 días)"
              hint={`de ${plural(data.learners.total, "colaborador", "colaboradores")}`}
            />
            <Kpi
              value={formatPercent(data.completion_rate)}
              label="Tasa de finalización"
              hint={`${data.enrollments.completed} de ${plural(data.enrollments.total, "inscripción", "inscripciones")}`}
            />
            <Kpi value={formatPercent(data.average_score)} label="Puntaje promedio" />
          </dl>
        ) : dashboard.isLoading ? (
          <Skeleton className="h-20 bg-white/10" />
        ) : null}
      </PageHero>

      {dashboard.error && !data ? (
        <section className="container py-12">
          <QueryError query={dashboard} />
        </section>
      ) : (
      <section className="container grid gap-10 py-12 lg:grid-cols-[1.4fr_1fr]">

        <div>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="display-md">Actividad reciente</h2>
            {data?.courses.generating ? (
              <span className="inline-flex items-center gap-2 text-sm text-accent">
                <Sparkles className="h-4 w-4" /> {plural(data.courses.generating, "curso")} generándose
              </span>
            ) : null}
          </div>
          {dashboard.isLoading ? (
            <Skeleton className="h-64" />
          ) : data?.recent_activity.length ? (
            <ol className="divide-y divide-border border border-border bg-white">
              {data.recent_activity.map((item) => (
                <ActivityItem key={`${item.kind}-${item.course_id}-${item.user_name}-${item.at}`} item={item} />
              ))}
            </ol>
          ) : (
            <EmptyState title="Sin actividad todavía" description="Cuando tu equipo avance en los cursos lo verás aquí." />
          )}
        </div>

        <div>
          <h2 className="display-md mb-5">Cursos con más personas</h2>
          {data?.top_courses.length ? (
            <ol className="space-y-3">
              {data.top_courses.map((course, index) => (
                <TopCourseItem key={course.id} course={course} rank={index + 1} />
              ))}
            </ol>
          ) : (
            !dashboard.isLoading && <EmptyState title="Aún no hay inscripciones" description="Asigna cursos a tu equipo desde cada curso." />
          )}
        </div>
      </section>
      )}
    </>
  );
}
