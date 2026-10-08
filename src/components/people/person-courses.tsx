"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { EnrollmentBadge } from "@/components/courses/status-badge";
import { QueryError } from "@/components/layout/query-state";
import { pathPlace } from "@/components/learn/learner-course-card";
import { Skeleton } from "@/components/ui/skeleton";
import { userKeys, usersApi } from "@/lib/api/users";
import { formatDate, plural } from "@/lib/format";
import { ProgressLine } from "./progress-line";

/** Every course a person was assigned, with their progress, the path it belongs to and whether it is still locked. */
export function PersonCourses({ userId }: { userId: number }) {
  const courses = useQuery({ queryKey: userKeys.courses(userId), queryFn: () => usersApi.courses(userId) });
  if (courses.isPending) return <Skeleton className="h-40" />;
  if (!courses.data) return <QueryError query={courses} />;
  if (!courses.data.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No tiene cursos asignados. Asígnalos desde cada curso, en Participantes, o con una ruta de aprendizaje.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {courses.data.map((course) => (
        <li key={course.course_id} className="border border-border p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            {/* A finger-sized target (taller than its line) without spacing the card out. */}
            <Link href={`/admin/courses/${course.course_id}`} className="-my-2.5 min-w-0 py-2.5 font-semibold hover:text-accent">
              {course.title}
            </Link>
            <EnrollmentBadge status={course.status} />
          </div>
          <ProgressLine value={course.progress_pct} />
          <p className="mt-2 text-xs text-muted-foreground">
            {course.completed_modules} de {plural(course.total_modules, "módulo")}
            {course.completed_at ? ` · terminado el ${formatDate(course.completed_at)}` : ""}
          </p>
          {course.path && <p className="mt-1 text-xs text-muted-foreground">{pathPlace(course)}</p>}
          {course.locked_by && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden /> Se desbloquea al terminar «{course.locked_by.title}»
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
