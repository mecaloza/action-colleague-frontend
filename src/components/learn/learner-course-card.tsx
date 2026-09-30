import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Layers } from "lucide-react";
import { CoverArt } from "@/components/courses/course-card";
import { EnrollmentBadge } from "@/components/courses/status-badge";
import { Progress } from "@/components/ui/progress";
import type { LearnerCourse } from "@/lib/api/types";
import { formatLength, formatPercent, plural } from "@/lib/format";
import { useStableUrl } from "@/lib/hooks/use-stable-url";

export const courseHref = (course: Pick<LearnerCourse, "course_id" | "next_module_id">) =>
  `/learn/${course.course_id}${course.next_module_id ? `?m=${course.next_module_id}` : ""}`;

/** The call to action of a course still open: start it, or pick it up again. */
export const courseActionLabel = (course: Pick<LearnerCourse, "status">) =>
  course.status === "assigned" ? "Empezar" : "Continuar";

export function LearnerCourseCard({ course }: { course: LearnerCourse }) {
  const cover = useStableUrl(course.cover_url);
  const done = course.status === "completed";
  return (
    <Link
      href={courseHref(course)}
      className="group flex flex-col border border-border bg-white transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ink-800 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <CoverArt title={course.title} seed={course.course_id} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        )}
        <div className="absolute left-3 top-3">
          <EnrollmentBadge status={course.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-semibold leading-tight tracking-tightest group-hover:text-accent">{course.title}</h3>
        {course.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
        <div className="mt-auto space-y-3 pt-5">
          <div className="flex items-center gap-3">
            <Progress value={course.progress_pct} className="flex-1" />
            <span className="w-10 text-right text-xs font-semibold">{formatPercent(course.progress_pct)}</span>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" aria-hidden /> {course.completed_modules} de {plural(course.total_modules, "módulo")}
            </span>
            {course.total_duration_seconds > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden /> {formatLength(course.total_duration_seconds)}
              </span>
            )}
          </p>
          <p className="flex items-center gap-2 border-t border-border pt-3 text-[11px] font-bold uppercase tracking-label text-ink-800 group-hover:text-accent">
            {done ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" /> Repasar el curso
              </>
            ) : (
              <>
                {courseActionLabel(course)} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
