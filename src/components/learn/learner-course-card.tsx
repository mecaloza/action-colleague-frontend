import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, Clock, Layers, Lock } from "lucide-react";
import { CoverArt } from "@/components/courses/course-card";
import { EnrollmentBadge } from "@/components/courses/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { LearnerCourse } from "@/lib/api/types";
import { formatLength, formatPercent, plural } from "@/lib/format";
import { useStableUrl } from "@/lib/hooks/use-stable-url";
import { safeHttpUrl } from "@/lib/safe-url";

export const courseHref = (course: Pick<LearnerCourse, "course_id" | "next_module_id">) =>
  `/learn/${course.course_id}${course.next_module_id ? `?m=${course.next_module_id}` : ""}`;

/** The call to action of a course still open: start it, or pick it up again. */
export const courseActionLabel = (course: Pick<LearnerCourse, "status">) =>
  course.status === "assigned" ? "Empezar" : "Continuar";

/** "Ruta Asesor de flotas", or the title as it is when it already says so ("Ruta de flotas", "Rutas comerciales"). */
export const pathName = (title: string) => (/^rutas?\b/i.test(title.trim()) ? title : `Ruta ${title}`);

/** "Ruta Asesor de flotas · curso 2 de 3": where the course sits in the learner's path. */
export const pathPlace = ({ path }: Pick<LearnerCourse, "path">) =>
  path ? `${pathName(path.title)} · curso ${path.step} de ${path.steps}` : null;

/** A course its path keeps closed: no link (it can't be opened yet), and the course that opens it. */
function LockedCourseCard({ course }: { course: LearnerCourse }) {
  const cover = useStableUrl(course.cover_url);
  const place = pathPlace(course);
  return (
    <div className="flex flex-col border border-border bg-white">
      <div className="relative aspect-[16/9] overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover opacity-50 grayscale" />
        ) : (
          <CoverArt title={course.title} seed={course.course_id} className="opacity-50" />
        )}
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="flex h-12 w-12 items-center justify-center bg-white text-ink-800 shadow-lg">
            <Lock className="h-5 w-5" />
          </span>
        </div>
        <div className="absolute left-3 top-3">
          <Badge variant="secondary">
            <Lock className="h-3 w-3" aria-hidden /> Bloqueado
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="break-words font-display text-xl font-semibold leading-tight tracking-tightest text-ink-700">{course.title}</h3>
        {course.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
        <div className="mt-auto space-y-3 pt-5">
          {place && <p className="text-xs text-muted-foreground">{place}</p>}
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm">
              {course.locked_by
                ? `Se desbloquea al terminar «${course.locked_by.title}».`
                : "Se desbloquea al terminar el curso anterior de tu ruta."}
            </p>
            {course.locked_by && (
              <Button variant="outline" size="sm" className="h-auto min-h-9 max-w-full whitespace-normal py-2 text-left" asChild>
                <Link href={`/learn/${course.locked_by.course_id}`}>
                  Ir a «{course.locked_by.title}» <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LearnerCourseCard({ course }: { course: LearnerCourse }) {
  const cover = useStableUrl(course.cover_url);
  if (course.locked) return <LockedCourseCard course={course} />;
  const done = course.status === "completed";
  const place = pathPlace(course);
  const certificate = safeHttpUrl(course.certificate?.pdf_url);
  return (
    // The whole card opens the course: its title's link covers it (`after:`), so the certificate's own link sits
    // beside it, never inside another link.
    <div className="group relative flex flex-col border border-border bg-white transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ink-800 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]">
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
        <h3 className="font-display text-xl font-semibold leading-tight tracking-tightest group-hover:text-accent">
          <Link
            href={courseHref(course)}
            className="after:absolute after:inset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-offset-2"
          >
            {course.title}
          </Link>
        </h3>
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
          {place && <p className="text-xs text-muted-foreground">{place}</p>}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-label text-ink-800 group-hover:text-accent" aria-hidden>
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
            {certificate && (
              <a
                href={certificate}
                target="_blank"
                rel="noopener"
                className="relative z-10 -my-2 inline-flex min-h-10 items-center gap-1.5 text-[11px] font-bold uppercase tracking-label text-accent-strong hover:underline"
              >
                <Award className="h-4 w-4" aria-hidden /> Certificado
                <span className="sr-only"> de «{course.title}»</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
