"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, CheckCircle2, ChevronDown, Circle, Lock, RotateCcw } from "lucide-react";
import { EnrollmentBadge, StatusBadge } from "@/components/courses/status-badge";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { QueryError } from "@/components/layout/query-state";
import { ACTIVITY_LABELS } from "@/components/learn/activities/activity-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { PersonActivity, PersonCourse, PersonModule, QuizSummary } from "@/lib/api/types";
import { userKeys, usersApi } from "@/lib/api/users";
import { formatDate, formatPercent, formatRelative, plural, twoDigits } from "@/lib/format";
import { safeHttpUrl } from "@/lib/safe-url";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { AttemptCard } from "./attempt-card";

/** Who the course card is about: their id (for the requests) and their name (for what it says). */
interface Person {
  id: number;
  name: string;
}

/** Out of attempts without passing: only an admin can give them more ("Dar otro intento"). */
const outOfAttempts = (quiz: QuizSummary) => !quiz.passed && quiz.attempts_used >= quiz.max_attempts;

/** "Aprobada con 80%", "Usó todos sus intentos · mejor 40%", "No aprobada · mejor 60%" or "Sin presentar". */
function quizState(quiz: QuizSummary): { text: string; badge: string; variant: "success" | "destructive" | "secondary" } {
  const best = quiz.best_score !== null ? ` · mejor ${formatPercent(quiz.best_score)}` : "";
  if (quiz.passed) return { text: `Aprobada con ${formatPercent(quiz.best_score ?? 0)}`, badge: "Aprobada", variant: "success" };
  if (outOfAttempts(quiz)) return { text: `Usó todos sus intentos${best}`, badge: "Sin intentos", variant: "destructive" };
  // A best score without attempts used: they took it before an admin gave the attempts back.
  if (quiz.attempts_used || quiz.best_score !== null) return { text: `No aprobada${best}`, badge: "En curso", variant: "secondary" };
  return { text: "Sin presentar", badge: "Pendiente", variant: "secondary" };
}

/** Their attempts at this module's quiz, question by question (the course's are asked for once, when first shown). */
function ModuleAttempts({ courseId, person, moduleId }: { courseId: number; person: Person; moduleId: number }) {
  const attempts = useQuery({
    queryKey: courseKeys.attempts(courseId, person.id),
    queryFn: () => coursesApi.participantAttempts(courseId, person.id),
  });
  if (attempts.isPending) return <Skeleton className="h-24" />;
  if (!attempts.data) return <QueryError query={attempts} />;
  const mine = attempts.data.find((module) => module.module_id === moduleId)?.attempts ?? [];
  if (!mine.length) return <p className="text-xs text-muted-foreground">Sin intentos guardados.</p>;
  return (
    <ol className="space-y-2" aria-label="Sus intentos">
      {mine.map((attempt) => (
        <AttemptCard key={attempt.attempt_number} attempt={attempt} />
      ))}
    </ol>
  );
}

interface QuizLineProps {
  courseId: number;
  module: PersonModule;
  quiz: QuizSummary;
  person: Person;
}

/** The module's quiz: how it went, the attempts used, their answers, and "Dar otro intento" once they ran out. */
function QuizLine({ courseId, module, quiz, person }: QuizLineProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [showAttempts, setShowAttempts] = useState(false);
  const status = useRef<HTMLParagraphElement>(null);
  const attemptsId = useId();
  const state = quizState(quiz);

  const reset = useMutation({
    mutationFn: () => usersApi.resetQuiz(person.id, module.module_id),
    onSuccess: (result) => {
      toast.success(
        `${person.name} puede presentar «${module.title}» de nuevo: ${plural(result.max_attempts, "intento")}.`,
      );
      // The button leaves with the attempts given back: the focus stays on the quiz, which now says so.
      status.current?.focus();
    },
    onError: toastError,
    // Also after a refusal: they may have passed it meanwhile (409), and the page shows it.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.detail(person.id) });
      void queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
    },
  });

  const askReset = async () => {
    const confirmed = await confirm({
      title: `¿Darle otro intento a ${person.name}?`,
      description: `Vuelve a tener ${plural(quiz.max_attempts, "intento")} para la evaluación de «${module.title}». Lo que respondió antes se conserva en su historial.`,
      confirmLabel: "Dar otro intento",
    });
    if (confirmed) reset.mutate();
  };

  return (
    <div className="space-y-2 border-l-2 border-border pl-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p ref={status} tabIndex={-1} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm outline-none">
            <span className="font-semibold">Evaluación</span>
            <Badge variant={state.variant}>{state.badge}</Badge>
            <span>{state.text}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {quiz.attempts_used} de {plural(quiz.max_attempts, "intento usado", "intentos usados")} · se aprueba con{" "}
            {quiz.passing_score}% · {plural(quiz.question_count, "pregunta")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Their answers stay after "Dar otro intento" (the best score tells there were some). */}
          {(quiz.attempts_used > 0 || quiz.best_score !== null) && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showAttempts}
              aria-controls={attemptsId}
              onClick={() => setShowAttempts((shown) => !shown)}
            >
              <ChevronDown className={cn("transition-transform", showAttempts && "rotate-180")} />
              {showAttempts ? "Ocultar respuestas" : "Ver respuestas"}
              <span className="sr-only"> de «{module.title}»</span>
            </Button>
          )}
          {outOfAttempts(quiz) && (
            <Button variant="outline" size="sm" onClick={() => void askReset()} loading={reset.isPending}>
              <RotateCcw /> Dar otro intento
              <span className="sr-only"> en «{module.title}»</span>
            </Button>
          )}
        </div>
      </div>
      <div id={attemptsId} hidden={!showAttempts}>
        {showAttempts && <ModuleAttempts courseId={courseId} person={person} moduleId={module.module_id} />}
      </div>
    </div>
  );
}

/** "Mejor: 8 de 10 · 3 partidas · hace 2 días", or "Sin jugar". */
function playsText(activity: PersonActivity): string {
  if (!activity.plays) return "Sin jugar";
  const best = activity.best_score !== null ? `Mejor: ${activity.best_score} de ${activity.max_score} · ` : "";
  const last = activity.last_played_at ? ` · ${formatRelative(activity.last_played_at)}` : "";
  return `${best}${plural(activity.plays, "partida")}${last}`;
}

function ModuleRow({ courseId, module, person }: { courseId: number; module: PersonModule; person: Person }) {
  return (
    <li className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        {module.completed ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" role="img" aria-label="Completado" />
        ) : (
          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" role="img" aria-label="Sin completar" />
        )}
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold">
            <span className="mr-2 font-display text-accent-strong">{twoDigits(module.order)}</span>
            {module.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {module.completed ? `Completado el ${formatDate(module.completed_at)}` : "Sin completar"}
          </p>
        </div>
      </div>
      {(module.quiz || module.activities.length > 0) && (
        <div className="space-y-3 sm:pl-8">
          {module.quiz && <QuizLine courseId={courseId} module={module} quiz={module.quiz} person={person} />}
          {module.activities.length > 0 && (
            <ul className="space-y-2 border-l-2 border-border pl-3" aria-label={`Actividades de ${module.title}`}>
              {module.activities.map((activity) => (
                <li key={activity.activity_id} className="text-sm">
                  <p className="break-words">
                    <span className="font-semibold">{activity.title}</span>{" "}
                    <span className="text-xs text-muted-foreground">· {ACTIVITY_LABELS[activity.type] ?? "Actividad"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{playsText(activity)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

interface PersonCourseCardProps {
  course: PersonCourse;
  person: Person;
  /** Opened, and brought into view, as the page loads (a link from this course's participants). */
  focused?: boolean;
}

/** One of their courses: progress, state and certificate; opened, each module's quiz and activities. */
export function PersonCourseCard({ course, person, focused = false }: PersonCourseCardProps) {
  const [open, setOpen] = useState(focused);
  const card = useRef<HTMLLIElement>(null);
  const modulesId = useId();
  const completed = course.modules.filter((module) => module.completed).length;
  const certificate = safeHttpUrl(course.certificate?.pdf_url);

  useEffect(() => {
    if (focused) card.current?.scrollIntoView({ block: "start" });
  }, [focused]);

  return (
    <li ref={card} className="scroll-mt-24 border border-border bg-white">
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-display text-xl font-medium leading-tight tracking-tightest">
            <Link href={`/admin/courses/${course.course_id}?tab=participants`} className="-my-1 inline-block break-words py-1 hover:text-accent">
              {course.title}
            </Link>
          </h3>
          <EnrollmentBadge status={course.status} />
        </div>
        {(course.course_status !== "published" || course.locked) && (
          <div className="flex flex-wrap items-center gap-2">
            {course.course_status !== "published" && <StatusBadge status={course.course_status} />}
            {course.locked && (
              <Badge variant="secondary">
                <Lock className="h-3 w-3" aria-hidden /> Bloqueado por su ruta
              </Badge>
            )}
          </div>
        )}
        <div>
          <div className="flex items-center gap-3">
            <Progress value={course.progress_pct} className="flex-1" aria-label={`Avance en ${course.title}`} />
            <span className="w-10 text-right text-xs font-semibold">{formatPercent(course.progress_pct)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {completed} de {plural(course.modules.length, "módulo")}
            {course.completed_at
              ? ` · terminado el ${formatDate(course.completed_at)}`
              : course.enrolled_at
                ? ` · asignado el ${formatDate(course.enrolled_at)}`
                : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3"
            aria-expanded={open}
            aria-controls={modulesId}
            onClick={() => setOpen((shown) => !shown)}
          >
            <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
            {open ? "Ocultar módulos" : "Ver módulos"}
            <span className="sr-only"> de «{course.title}»</span>
          </Button>
          {certificate && (
            <a
              href={certificate}
              target="_blank"
              rel="noopener"
              className="-my-2 inline-flex min-h-10 items-center gap-1.5 text-[11px] font-bold uppercase tracking-label text-accent-strong hover:underline"
            >
              <Award className="h-4 w-4" aria-hidden /> Certificado
              <span className="sr-only"> de «{course.title}»</span>
            </a>
          )}
        </div>
      </div>
      <div id={modulesId} hidden={!open} className="border-t border-border">
        {open &&
          (course.modules.length ? (
            <ol className="divide-y divide-border" aria-label={`Módulos de ${course.title}`}>
              {course.modules.map((module) => (
                <ModuleRow key={module.module_id} courseId={course.course_id} module={module} person={person} />
              ))}
            </ol>
          ) : (
            <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">Este curso aún no tiene módulos.</p>
          ))}
      </div>
    </li>
  );
}
