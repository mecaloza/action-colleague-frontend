import { Award, BookCheck, CheckCircle2, Gamepad2, GraduationCap, Route, XCircle, type LucideIcon } from "lucide-react";
import type { RecentEvent, RecentKind } from "@/lib/api/types";
import { formatDate, formatPercent, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

interface EventLook {
  icon: LucideIcon;
  tone: string;
  /** What they did, with the title in its place. */
  text: (title: string) => string;
}

const EVENTS: Record<RecentKind, EventLook> = {
  quiz_passed: { icon: CheckCircle2, tone: "text-success", text: (title) => `Aprobó la evaluación de «${title}»` },
  quiz_failed: { icon: XCircle, tone: "text-destructive", text: (title) => `No aprobó la evaluación de «${title}»` },
  activity_finished: { icon: Gamepad2, tone: "text-accent", text: (title) => `Jugó «${title}»` },
  module_completed: { icon: BookCheck, tone: "text-success", text: (title) => `Completó el módulo «${title}»` },
  course_completed: { icon: GraduationCap, tone: "text-success", text: (title) => `Completó el curso «${title}»` },
  certificate_issued: { icon: Award, tone: "text-accent", text: (title) => `Recibió el certificado de «${title}»` },
  path_completed: { icon: Route, tone: "text-success", text: (title) => `Completó la ruta «${title}»` },
};

// A kind this release doesn't know (a newer server's): said plainly.
const OTHER: EventLook = { icon: CheckCircle2, tone: "text-muted-foreground", text: (title) => `«${title}»` };

/** The line under it: the course it happened in, or a certificate's code. */
function detailOf(event: RecentEvent): string {
  if (!event.detail) return "";
  return event.kind === "certificate_issued" ? `Código ${event.detail}` : event.detail;
}

/** The latest things a person did in their courses, newest first. */
export function RecentActivity({ events }: { events: RecentEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">Todavía no ha avanzado en sus cursos.</p>;
  return (
    <ol className="divide-y divide-border border border-border bg-white" aria-label="Actividad reciente">
      {events.map((event, index) => {
        const look = EVENTS[event.kind] ?? OTHER;
        const Icon = look.icon;
        const detail = detailOf(event);
        return (
          <li key={`${event.kind}-${event.at}-${index}`} className="flex items-start gap-3 px-4 py-3 sm:gap-4 sm:px-5">
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", look.tone)} aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="break-words">
                {look.text(event.title)}
                {event.score !== null && (
                  <span className="font-semibold">
                    {/* A certificate's is the average of the course's quizzes; a play's, its share of the maximum. */}
                    {event.kind === "certificate_issued"
                      ? ` · promedio ${formatPercent(event.score)}`
                      : ` (${formatPercent(event.score)})`}
                  </span>
                )}
              </p>
              {detail && <p className="break-words text-xs text-muted-foreground">{detail}</p>}
            </div>
            <time dateTime={event.at} title={formatDate(event.at, true)} className="shrink-0 text-xs text-muted-foreground">
              {formatRelative(event.at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
