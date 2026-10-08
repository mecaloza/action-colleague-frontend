"use client";

import { Suspense } from "react";
import Link from "next/link";
import { notFound, useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, BookOpen, History, Route, UserX } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageError, PageLoading, QueryError } from "@/components/layout/query-state";
import { PersonCertificates } from "@/components/people/person-certificates";
import { PersonCourseCard } from "@/components/people/person-course-card";
import { PersonHeader } from "@/components/people/person-header";
import { PersonPaths } from "@/components/people/person-paths";
import { RecentActivity } from "@/components/people/recent-activity";
import { PersonDialog } from "@/components/team/person-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import type { PersonOverview } from "@/lib/api/types";
import { userKeys, usersApi } from "@/lib/api/users";
import { useOpening } from "@/lib/hooks/use-opening";

interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ id, icon, title, children }: SectionProps) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="display-md mb-5 flex items-center gap-3">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

/** Their courses, newest first; `?course=` opens one (a link from its participants). */
function Courses({ overview, focusedCourse }: { overview: PersonOverview; focusedCourse: number | null }) {
  const { user, courses } = overview;
  if (!courses.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No tiene cursos asignados. Asígnalos desde cada curso, en Participantes, o con una ruta de aprendizaje.
      </p>
    );
  }
  return (
    <ul className="space-y-3" aria-label="Sus cursos">
      {courses.map((course) => (
        <PersonCourseCard
          key={course.course_id}
          course={course}
          person={{ id: user.id, name: user.name }}
          focused={course.course_id === focusedCourse}
        />
      ))}
    </ul>
  );
}

function PersonBody({ overview, focusedCourse }: { overview: PersonOverview; focusedCourse: number | null }) {
  const iconClass = "h-6 w-6 text-accent";
  return (
    <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
      <div className="min-w-0 space-y-12">
        <Section id="person-paths" icon={<Route className={iconClass} aria-hidden />} title="Rutas">
          <PersonPaths paths={overview.paths} />
        </Section>
        <Section id="person-courses" icon={<BookOpen className={iconClass} aria-hidden />} title="Cursos">
          <Courses overview={overview} focusedCourse={focusedCourse} />
        </Section>
      </div>
      <div className="min-w-0 space-y-12">
        <Section id="person-certificates" icon={<Award className={iconClass} aria-hidden />} title="Certificados">
          <PersonCertificates certificates={overview.certificates} />
        </Section>
        <Section id="person-recent" icon={<History className={iconClass} aria-hidden />} title="Actividad reciente">
          <RecentActivity events={overview.recent} />
        </Section>
      </div>
    </div>
  );
}

/** `?course=12`: the course to open as the page loads. */
function courseIn(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** A person's page ("ficha"): who they are, their figures, paths, courses module by module, certificates and latest. */
function Person() {
  const params = useParams<{ id: string }>();
  const userId = Number(params.id);
  const validId = Number.isInteger(userId) && userId > 0;
  const focusedCourse = courseIn(useSearchParams().get("course"));
  const editing = useOpening(null);

  const row = useQuery({ queryKey: userKeys.detail(userId), queryFn: () => usersApi.get(userId), enabled: validId });
  const overview = useQuery({
    queryKey: userKeys.overview(userId),
    queryFn: () => usersApi.overview(userId),
    enabled: validId,
  });

  if (!validId) notFound();
  if (row.isPending) return <PageLoading />;
  if (!row.data) {
    if (row.error instanceof ApiError && row.error.status === 404) {
      return (
        <div className="container py-12">
          <EmptyState
            icon={<UserX />}
            title="Esta persona no existe"
            description="Puede que el enlace esté mal escrito."
            action={
              <Button variant="outline" asChild>
                <Link href="/admin/team">
                  <ArrowLeft /> Volver al equipo
                </Link>
              </Button>
            }
          />
        </div>
      );
    }
    return <PageError query={row} />;
  }

  return (
    <>
      <PersonHeader person={row.data} overview={overview.data} loading={overview.isPending} onEdit={() => editing.show(null)} />
      <div className="container py-10">
        {overview.data ? (
          <PersonBody overview={overview.data} focusedCourse={focusedCourse} />
        ) : overview.isPending ? (
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        ) : (
          <QueryError query={overview} />
        )}
      </div>
      <PersonDialog key={editing.key} open={editing.open} onClose={editing.hide} person={row.data} />
    </>
  );
}

export default function PersonPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Person />
    </Suspense>
  );
}
