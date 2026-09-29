import Link from "next/link";
import { CheckCircle2, Layers, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CourseSummary } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

/** Generated cover for courses without an image: black field, brand diamonds and the initials. */
export function CoverArt({ title, seed, className }: { title: string; seed: number; className?: string }) {
  const initials = title
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  const x = 210 + ((seed * 37) % 50);
  const y = 40 + ((seed * 23) % 40);
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-ink-900", className)}>
      <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect x={x - 45} y={y - 45} width="90" height="90" transform={`rotate(45 ${x} ${y})`} fill="none" stroke="#fff" strokeOpacity=".12" />
        <rect x={x - 22} y={y + 38} width="44" height="44" transform={`rotate(45 ${x} ${y + 60})`} fill="none" stroke="#fff" strokeOpacity=".2" />
        <rect x={x + 30} y={y + 58} width="22" height="22" transform={`rotate(45 ${x + 41} ${y + 69})`} fill="#ff4c01" />
      </svg>
      <span className="absolute bottom-3 left-4 font-display text-5xl font-semibold tracking-tightest text-white/90">
        {initials || "AC"}
      </span>
    </div>
  );
}

export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link
      href={`/admin/courses/${course.id}`}
      className="group flex flex-col border border-border bg-white transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ink-800 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {course.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.cover_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <CoverArt title={course.title} seed={course.id} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <StatusBadge status={course.status} />
          <Badge variant="inverse" className="bg-black/60 backdrop-blur">
            {course.source === "ai" ? (
              <>
                <Sparkles className="h-3 w-3" /> IA
              </>
            ) : (
              "Material propio"
            )}
          </Badge>
        </div>
        {course.generating_count > 0 && (
          <Badge variant="accent" pulse className="absolute right-3 top-3">
            Generando
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-semibold leading-tight tracking-tightest group-hover:text-accent">
          {course.title}
        </h3>
        {course.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Módulos</dt>
            <dd>{course.module_count} mód.</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Participantes</dt>
            <dd>{course.enrolled_count}</dd>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Completado</dt>
            <dd className="font-semibold">{formatPercent(course.completion_rate)}</dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}

/** Placeholder with the proportions of CourseCard, shown while the library loads. */
export function CourseCardSkeleton() {
  return (
    <div className="border border-border">
      <Skeleton className="aspect-[16/9] rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
