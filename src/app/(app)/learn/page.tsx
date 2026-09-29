"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GraduationCap, PlayCircle } from "lucide-react";
import { CourseCardSkeleton } from "@/components/courses/course-card";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { QueryError } from "@/components/layout/query-state";
import { courseActionLabel, courseHref, LearnerCourseCard } from "@/components/learn/learner-course-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/auth-context";
import { learnApi, learnKeys } from "@/lib/api/learn";
import type { LearnerCourse } from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";

const GRID = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

const SECTIONS: { status: LearnerCourse["status"]; title: string }[] = [
  { status: "in_progress", title: "En curso" },
  { status: "assigned", title: "Por empezar" },
  { status: "completed", title: "Completados" },
];

/** The course to pick up now: one already started (most advanced first), or else the newest assigned. */
function nextUp(courses: LearnerCourse[]): LearnerCourse | undefined {
  const started = courses.filter((course) => course.status === "in_progress").sort((a, b) => b.progress_pct - a.progress_pct);
  return started[0] ?? courses.find((course) => course.status === "assigned");
}

/** The line under the greeting: how many courses are left. Nothing before they load, or when there are none. */
function progressSummary(pending: number, total: number): string | undefined {
  if (pending) return `Tienes ${plural(pending, "curso")} por terminar.`;
  return total ? "Terminaste todos tus cursos. ¡Buen trabajo!" : undefined;
}

function ContinueCard({ course }: { course: LearnerCourse }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-2xl border border-white/15 bg-white/5 p-6">
      <p className="eyebrow mb-3 text-white/60">{course.status === "assigned" ? "Empieza por aquí" : "Continúa donde lo dejaste"}</p>
      <p className="font-display text-2xl font-medium tracking-tightest text-white">{course.title}</p>
      {course.next_module_title && <p className="mt-1 text-sm text-white/70">Sigue: {course.next_module_title}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <div className="flex min-w-[180px] flex-1 items-center gap-3">
          <Progress value={course.progress_pct} className="flex-1 bg-white/15" />
          <span className="text-xs font-semibold text-white">{formatPercent(course.progress_pct)}</span>
        </div>
        <Button variant="accent" asChild>
          <Link href={courseHref(course)}>
            <PlayCircle /> {courseActionLabel(course)}
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

export default function MyCoursesPage() {
  const { user } = useAuth();
  const courses = useQuery({ queryKey: learnKeys.courses, queryFn: learnApi.courses });
  const list = courses.data ?? [];
  const toContinue = nextUp(list);
  const pending = list.filter((course) => course.status !== "completed").length;

  return (
    <>
      <PageHero
        eyebrow="Mis cursos"
        title={`Hola, ${user?.name.split(" ")[0] ?? ""}`.trim()}
        description={progressSummary(pending, list.length)}
      >
        {toContinue && <ContinueCard course={toContinue} />}
      </PageHero>

      <section className="container space-y-14 py-12">
        {courses.isPending ? (
          <div className={GRID}>
            {Array.from({ length: 3 }).map((_, index) => (
              <CourseCardSkeleton key={index} />
            ))}
          </div>
        ) : courses.error && !courses.data ? (
          <QueryError query={courses} />
        ) : !list.length ? (
          <EmptyState
            icon={<GraduationCap />}
            title="Aún no tienes cursos asignados"
            description="Cuando tu empresa te asigne un curso, aparecerá aquí."
          />
        ) : (
          SECTIONS.map(({ status, title }) => {
            const group = list.filter((course) => course.status === status);
            if (!group.length) return null;
            return (
              <div key={status}>
                <h2 className="mb-6 flex items-baseline gap-3 font-display text-3xl font-medium tracking-tightest">
                  {title} <span className="text-base font-normal text-muted-foreground">{group.length}</span>
                </h2>
                <div className={GRID}>
                  {group.map((course, index) => (
                    <motion.div key={course.course_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * index }}>
                      <LearnerCourseCard course={course} />
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
