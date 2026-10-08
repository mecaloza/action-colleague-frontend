"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, RotateCcw, Send, X } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { learnApi, learnKeys } from "@/lib/api/learn";
import { useReturnFocus } from "@/lib/hooks/use-return-focus";
import type { AttemptResult, LearnerModule, QuizResponse } from "@/lib/api/types";
import { plural, twoDigits } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { isAnswered, QuestionInput, responseFor } from "./question-input";
import { QuizResult } from "./quiz-result";

const TYPE_HINTS = {
  single_choice: "Elige una opción",
  true_false: "¿Verdadero o falso?",
  ordering: "Ordena los pasos",
  matching: "Une cada concepto con su pareja",
  fill_blank: "Completa la frase",
} as const;

interface QuizDialogProps {
  courseId: number;
  module: LearnerModule;
  /** Changes with every opening: each one loads its own copy of the quiz (never the previous attempt's). */
  session: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a passing attempt: go on (to the next module, or to the course's end). */
  onPassed: (result: AttemptResult) => void;
}

// A result action: full width on a phone (its label may wrap there), its own width from `sm` up.
const RESULT_ACTION = "h-auto min-h-12 w-full whitespace-normal py-3 sm:w-auto";
const NO_ATTEMPTS_LEFT = "Usaste todos los intentos. Habla con tu administrador si necesitas otro.";

/** Where the "passed" button leads. */
function passedLabel(result: AttemptResult): string {
  if (result.course_completed) return "Terminar el curso";
  return result.next_module_id ? "Siguiente módulo" : "Volver al curso";
}

/** Full-screen quiz, one question at a time; graded on the server, which never sends the answers. */
export function QuizDialog({ courseId, module, session, open, onOpenChange, onPassed }: QuizDialogProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuizResponse | null>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Every opening and every new attempt load their own copy (options are shuffled again): a key of their
  // own, so the previous attempt's order and count never show while it loads.
  const quiz = useQuery({
    queryKey: [...learnKeys.quiz(module.id), session, attempt],
    queryFn: () => learnApi.quiz(module.id),
    enabled: open,
    // This copy is this attempt's: a reconnect or a refocus must not shuffle the options again.
    staleTime: Infinity,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
  const focus = useReturnFocus();
  const questions = quiz.data?.questions ?? [];
  const question = questions[index];
  const answered = questions.filter((item) => isAnswered(item, answers[item.id] ?? null)).length;

  const reset = () => {
    setIndex(0);
    setAnswers({});
    setResult(null);
  };

  const restart = () => {
    reset();
    setAttempt((current) => current + 1);
  };

  const submit = useMutation({
    mutationFn: () =>
      learnApi.submit(
        module.id,
        questions.map((item) => ({ question_id: item.id, response: responseFor(item, answers[item.id] ?? null) })),
        quiz.data!.version,
      ),
    onSuccess: (graded) => {
      setResult(graded);
      void queryClient.invalidateQueries({ queryKey: learnKeys.course(courseId) });
      void queryClient.invalidateQueries({ queryKey: learnKeys.courses });
    },
    onError: (error) => {
      // Whatever it was (the quiz changed, no attempts left, already passed elsewhere): show the course as it is.
      void queryClient.invalidateQueries({ queryKey: learnKeys.course(courseId) });
      if (error instanceof ApiError && error.status === 409 && /cambió/.test(error.message)) {
        toast.error("La evaluación cambió mientras respondías; este intento no cuenta. Te mostramos la versión nueva.");
        restart();
        return;
      }
      toastError(error);
    },
  });

  const send = async () => {
    const missing = questions.length - answered;
    if (missing > 0) {
      const confirmed = await confirm({
        title: missing === 1 ? "Te falta 1 pregunta" : `Te faltan ${missing} preguntas`,
        description: "Las preguntas sin responder cuentan como incorrectas. ¿Enviar de todos modos?",
        confirmLabel: "Enviar",
      });
      if (!confirmed) return;
    }
    submit.mutate();
  };

  const close = async () => {
    if (submit.isPending) return; // it was sent: its result is on its way
    if (!result && Object.keys(answers).length > 0) {
      const confirmed = await confirm({
        title: "¿Salir de la evaluación?",
        description: "Tus respuestas no se guardan y el intento no cuenta.",
        confirmLabel: "Salir",
        destructive: true,
      });
      if (!confirmed) return;
    }
    onOpenChange(false);
    reset();
  };

  const attemptsLeft = result?.attempts_remaining ?? (quiz.data ? quiz.data.max_attempts - quiz.data.attempts_used : 0);
  // Passed, or out of attempts, on another device or tab meanwhile: nothing to answer here.
  let closedReason: string | null = null;
  if (!result && quiz.data) {
    if (quiz.data.passed) closedReason = "Ya aprobaste esta evaluación.";
    else if (attemptsLeft <= 0) closedReason = NO_ATTEMPTS_LEFT;
  }

  // Passed or out of attempts on another device or tab: the page behind shows it too (next module unlocked...).
  useEffect(() => {
    if (closedReason) void queryClient.invalidateQueries({ queryKey: learnKeys.course(courseId) });
  }, [closedReason, courseId, queryClient]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : void close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/90" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto overflow-x-hidden overscroll-contain bg-ink-950 text-white"
          {...focus}
        >
          {/* Sticky: the way out stays in reach while a long question or the results scroll. */}
          <div className="sticky top-0 z-10 shrink-0 border-b border-white/10 bg-ink-950/95 backdrop-blur">
            <div className="container flex h-16 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow text-white/50">Evaluación</p>
                <DialogPrimitive.Title className="truncate font-display text-lg font-medium">{module.title}</DialogPrimitive.Title>
              </div>
              <button
                type="button"
                onClick={() => void close()}
                className="flex h-10 w-10 shrink-0 items-center justify-center"
                aria-label="Cerrar evaluación"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="container max-w-3xl flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-6">
            {quiz.isPending ? (
              <Skeleton className="h-72 bg-white/10 bg-none" />
            ) : !quiz.data ? (
              <div className="space-y-4">
                <p role="alert" className="text-white/80">
                  {quiz.error instanceof Error ? quiz.error.message : "No pudimos cargar la evaluación."}
                </p>
                <Button variant="outline-inverse" onClick={() => void quiz.refetch()} loading={quiz.isFetching}>
                  <RotateCcw /> Reintentar
                </Button>
              </div>
            ) : closedReason ? (
              <div className="space-y-6">
                <p role="status" className="border-l-2 border-white/40 bg-white/5 px-4 py-3 text-white/85">
                  {closedReason}
                </p>
                <Button variant="outline-inverse" size="lg" onClick={() => void close()}>
                  Volver al módulo
                </Button>
              </div>
            ) : result ? (
              <QuizResult
                result={result}
                questions={questions}
                passingScore={quiz.data.passing_score}
                actions={
                  // Right under the score, before the answers: the next step needs no scroll past the list.
                  // Stacked full width on a phone, where long labels wrap instead of overflowing.
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {result.passed ? (
                      <Button variant="accent" size="lg" className={RESULT_ACTION} onClick={() => onPassed(result)}>
                        {passedLabel(result)} <ArrowRight />
                      </Button>
                    ) : attemptsLeft > 0 ? (
                      <Button variant="accent" size="lg" className={RESULT_ACTION} onClick={restart}>
                        <RotateCcw /> Intentar de nuevo ({plural(attemptsLeft, "intento")})
                      </Button>
                    ) : (
                      <p className="border-l-2 border-white/40 bg-white/5 px-4 py-3 text-sm text-white/80">
                        {NO_ATTEMPTS_LEFT}
                      </p>
                    )}
                    <Button variant="outline-inverse" size="lg" className={RESULT_ACTION} onClick={() => void close()}>
                      Revisar el módulo
                    </Button>
                  </div>
                }
              />
            ) : question ? (
              <div className="space-y-6 sm:space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-white/60">
                    <span>
                      Pregunta {index + 1} de {questions.length}
                    </span>
                    <span>{plural(attemptsLeft, "intento")} disponible{attemptsLeft === 1 ? "" : "s"}</span>
                  </div>
                  <Progress value={((index + 1) / questions.length) * 100} className="bg-white/15" />
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-6"
                  >
                    <div>
                      <p className="eyebrow mb-3 text-white/50">{TYPE_HINTS[question.type]}</p>
                      <h3 className="font-display text-xl font-medium leading-tight tracking-tightest sm:text-3xl">
                        <span className="mr-3 text-accent">{twoDigits(index + 1)}</span>
                        {question.prompt}
                      </h3>
                    </div>
                    <div className="text-ink-900">
                      <QuestionInput
                        question={question}
                        response={answers[question.id] ?? null}
                        onChange={(response) => setAnswers((current) => ({ ...current, [question.id]: response }))}
                      />
                    </div>
                  </motion.div>
                </AnimatePresence>
                {/* On a phone "Anterior" is just its arrow and the main button takes the rest: they fit at 320 px. */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
                  <Button
                    variant="outline-inverse"
                    className="w-11 shrink-0 px-0 sm:w-auto sm:px-6"
                    onClick={() => setIndex(index - 1)}
                    disabled={index === 0}
                  >
                    <ArrowLeft /> <span className="sr-only sm:not-sr-only">Anterior</span>
                  </Button>
                  {index < questions.length - 1 ? (
                    <Button variant="inverse" className="flex-1 sm:flex-none" onClick={() => setIndex(index + 1)}>
                      Siguiente <ArrowRight />
                    </Button>
                  ) : (
                    <Button
                      variant="accent"
                      className="flex-1 sm:flex-none"
                      onClick={() => void send()}
                      loading={submit.isPending}
                    >
                      <Send /> Enviar respuestas
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
