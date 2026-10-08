"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Award, CheckCircle2, Route, Sparkles, XCircle } from "lucide-react";
import { NewCourseButton } from "@/components/courses/new-course-button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { QueryError } from "@/components/layout/query-state";
import { Kpi } from "@/components/people/kpi";
import { TopTodayCard } from "@/components/ranking/top-today-card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { dashboardApi, dashboardKeys } from "@/lib/api/dashboard";
import type { Dashboard, DashboardActivity, DashboardActivityKind } from "@/lib/api/types";
import { formatDate, formatPercent, formatRelative, plural, twoDigits } from "@/lib/format";

/** The panel refreshes itself this often. */
const REFRESH_MS = 30_000;

// A divider before every figure but the first of its row: two rows of two on phones, one row of four from md.
const KPI_DIVIDERS = "even:border-l even:pl-6 md:border-l md:pl-6 md:first:border-l-0 md:first:pl-0";

const ACTIVITY_TEXT: Record<DashboardActivityKind, string> = {
  passed_quiz: "aprobó la evaluación de",
  failed_quiz: "no aprobó la evaluación de",
  completed_course: "completó el curso",
  certificate_issued: "recibió el certificado de",
  path_completed: "completó la ruta",
};

/** What the item is about, linked to its page when it still exists: the module or course, or the path. */
function ActivityTarget({ item }: { item: DashboardActivity }) {
  const className = "font-semibold hover:text-accent";
  if (item.path_title != null) {
    const title = item.path_title;
    return item.path_id != null ? (
      <Link href={`/admin/paths/${item.path_id}`} className={className}>
        {title}
      </Link>
    ) : (
      <span className="font-semibold">{title}</span>
    );
  }
  const title = item.module_title ?? item.course_title;
  return item.course_id != null ? (
    <Link href={`/admin/courses/${item.course_id}`} className={className}>
      {title}
    </Link>
  ) : (
    <span className="font-semibold">{title}</span>
  );
}

function ActivityIcon({ kind }: { kind: DashboardActivityKind }) {
  const className = "mt-0.5 h-5 w-5 shrink-0";
  if (kind === "failed_quiz") return <XCircle className={`${className} text-destructive`} />;
  if (kind === "certificate_issued") return <Award className={`${className} text-accent`} />;
  if (kind === "path_completed") return <Route className={`${className} text-success`} />;
  return <CheckCircle2 className={`${className} text-success`} />;
}

function ActivityItem({ item }: { item: DashboardActivity }) {
  const showScore = item.score !== null && (item.kind === "passed_quiz" || item.kind === "failed_quiz");
  // Under it: the course of a module, or the code of a certificate.
  const detail = item.certificate_code ? `Código ${item.certificate_code}` : item.module_title ? item.course_title : null;
  return (
    <li className="flex items-start gap-4 px-5 py-4">
      <ActivityIcon kind={item.kind} />
      <div className="min-w-0 flex-1 break-words text-sm">
        <p>
          <Link href={`/admin/team/${item.user_id}`} className="font-semibold hover:text-accent">
            {item.user_name}
          </Link>{" "}
          {ACTIVITY_TEXT[item.kind] ?? "avanzó en"} <ActivityTarget item={item} />
          {showScore ? ` (${formatPercent(item.score)})` : ""}
        </p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      {item.at && (
        <time dateTime={item.at} title={formatDate(item.at, true)} className="shrink-0 text-xs text-muted-foreground">
          {formatRelative(item.at)}
        </time>
      )}
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
  const dashboard = useQuery({ queryKey: dashboardKeys.all, queryFn: dashboardApi.get, refetchInterval: REFRESH_MS });
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
            <Kpi
              value={String(data.courses.published)}
              label="Cursos publicados"
              hint={`${data.courses.draft} en borrador`}
              className={KPI_DIVIDERS}
            />
            <Kpi
              value={String(data.learners.active_30d)}
              label="Personas activas (30 días)"
              hint={`de ${plural(data.learners.total, "colaborador", "colaboradores")}`}
              className={KPI_DIVIDERS}
            />
            <Kpi
              value={formatPercent(data.completion_rate)}
              label="Tasa de finalización"
              hint={`${data.enrollments.completed} de ${plural(data.enrollments.total, "inscripción", "inscripciones")}`}
              className={KPI_DIVIDERS}
            />
            <Kpi value={formatPercent(data.average_score)} label="Puntaje promedio" className={KPI_DIVIDERS} />
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
              {data.recent_activity.map((item, index) => (
                <ActivityItem key={`${item.kind}-${item.course_id}-${item.user_name}-${item.at}-${index}`} item={item} />
              ))}
            </ol>
          ) : (
            <EmptyState title="Sin actividad todavía" description="Cuando tu equipo avance en los cursos lo verás aquí." />
          )}
        </div>

        <div className="space-y-12">
          <TopTodayCard refetchInterval={REFRESH_MS} />
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
        </div>
      </section>
      )}
    </>
  );
}
