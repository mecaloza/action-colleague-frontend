"use client";

import { ArrowRight, CheckCircle2, FileText, HelpCircle, Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LearnerModule, QuizSummary } from "@/lib/api/types";
import { formatDuration, formatPercent, plural, twoDigits } from "@/lib/format";
import { safeHttpUrl } from "@/lib/safe-url";
import { LearnerVideo } from "./learner-video";
import { Reading } from "./reading";

interface ModuleViewProps {
  module: LearnerModule;
  nextModule: LearnerModule | null;
  completing: boolean;
  onComplete: () => void;
  onOpenQuiz: () => void;
  onNext: () => void;
}

/** The line under the quiz title: the module is done, or what is left to try. */
function quizStatus(quiz: QuizSummary, attemptsLeft: number): string {
  if (quiz.passed) return "Ya completaste este módulo.";
  if (attemptsLeft > 0) {
    const best = quiz.best_score !== null ? ` · tu mejor puntaje: ${formatPercent(quiz.best_score)}` : "";
    return `${plural(attemptsLeft, "intento")} disponible${attemptsLeft === 1 ? "" : "s"}${best}`;
  }
  return "Usaste todos los intentos. Habla con tu administrador si necesitas otro.";
}

type QuizCardProps = Pick<ModuleViewProps, "nextModule" | "onOpenQuiz" | "onNext"> & { quiz: QuizSummary };

function QuizCard({ quiz, nextModule, onOpenQuiz, onNext }: QuizCardProps) {
  const attemptsLeft = quiz.max_attempts - quiz.attempts_used;
  return (
    <div className="band-dark p-6 sm:p-8">
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow mb-2 text-white/60">Evaluación</p>
          {quiz.passed ? (
            <p className="flex items-center gap-2 font-display text-2xl font-medium text-white">
              <Trophy className="h-6 w-6 text-accent" /> Aprobada con {formatPercent(quiz.best_score ?? 0)}
            </p>
          ) : (
            <p className="font-display text-2xl font-medium text-white">
              {plural(quiz.question_count, "pregunta")} · se aprueba con {quiz.passing_score}%
            </p>
          )}
          <p className="mt-1 text-sm text-white/60">{quizStatus(quiz, attemptsLeft)}</p>
        </div>
        {quiz.passed ? (
          nextModule && (
            <Button variant="accent" onClick={onNext}>
              Siguiente módulo <ArrowRight />
            </Button>
          )
        ) : (
          attemptsLeft > 0 && (
            <Button variant="accent" size="lg" onClick={onOpenQuiz}>
              <HelpCircle /> {quiz.attempts_used ? "Intentar de nuevo" : "Presentar evaluación"}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

/** Everything a learner studies in a module, and how they complete it. */
export function ModuleView({ module, nextModule, completing, onComplete, onOpenQuiz, onNext }: ModuleViewProps) {
  if (!module.unlocked) {
    return (
      <div className="flex flex-col items-center gap-4 border border-border bg-white px-6 py-16 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="display-md">Este módulo aún está bloqueado</p>
        <p className="text-muted-foreground">Completa el módulo anterior para continuar.</p>
      </div>
    );
  }
  const documentUrl = safeHttpUrl(module.document?.url);
  const empty = !module.video && !documentUrl && !module.content_text;
  return (
    <article className="space-y-8">
      <header>
        <p className="eyebrow mb-3">
          Módulo {twoDigits(module.order)}
          {module.duration_seconds ? ` · ${formatDuration(module.duration_seconds)}` : ""}
        </p>
        <h2 className="display-lg text-balance">{module.title}</h2>
        {module.description && <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{module.description}</p>}
      </header>

      {module.video && <LearnerVideo module={module} />}
      {documentUrl && (
        <Button variant="outline" asChild>
          <a href={documentUrl} target="_blank" rel="noreferrer">
            <FileText /> Abrir documento
          </a>
        </Button>
      )}
      {module.content_text && <Reading text={module.content_text} />}
      {empty && <p className="text-muted-foreground">Este módulo aún no tiene contenido.</p>}

      {module.quiz ? (
        <QuizCard quiz={module.quiz} nextModule={nextModule} onOpenQuiz={onOpenQuiz} onNext={onNext} />
      ) : module.completed ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="h-5 w-5" /> Módulo completado
          </p>
          {nextModule && (
            <Button variant="accent" onClick={onNext}>
              Siguiente módulo <ArrowRight />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">¿Terminaste? Márcalo para seguir con el siguiente módulo.</p>
          <Button variant="accent" onClick={onComplete} loading={completing}>
            <CheckCircle2 /> Marcar como completado
          </Button>
        </div>
      )}
    </article>
  );
}
