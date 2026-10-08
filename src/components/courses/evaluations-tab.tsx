"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, HelpCircle, History, Plus, Sparkles, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { QueryError } from "@/components/layout/query-state";
import { RevisionSheet, type RevisionTab, useRevisionSheet } from "@/components/studio/revision-sheet";
import { usePendingRevision } from "@/components/studio/revision-status";
import { useUnsavedEdits } from "@/components/studio/use-revision-cache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import { settingsApi, settingsKeys } from "@/lib/api/settings";
import type { CourseDetail, EvaluationAdmin, EvaluationDefaults, ModuleAdmin, Question, QuestionType } from "@/lib/api/types";
import { moveItem, removeAt, replaceAt } from "@/lib/array";
import { plural, twoDigits } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { QuestionEditor } from "./question-editor";
import { QUESTION_TYPES, blankQuestion, questionProblem } from "./question-model";
import { SuggestQuestionsButton } from "./suggest-questions-button";

const MAX_QUESTIONS = 30; // EvaluationPut.questions max_length

/** Whole number typed in a field, or null while it is empty, fractional or outside [min, max]. */
function wholeNumberIn(raw: string, min: number, max: number): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function AddQuestionMenu({ onAdd }: { onAdd: (type: QuestionType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Plus /> Agregar pregunta
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {QUESTION_TYPES.map((type) => (
          <DropdownMenuItem key={type.value} onSelect={() => onAdd(type.value)}>
            <div>
              <p className="font-semibold">{type.label}</p>
              <p className="text-xs text-muted-foreground">{type.hint}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Opens "Cambios a la evaluación" of the module: a new change (to some questions, or all of them) or its history. */
type RequestQuizChange = (options?: { questionIds?: string[]; tab?: RevisionTab }) => void;

/** The heading of the module's «Cambios con IA»: the focus lands there when what opened its panel is gone. */
const quizChangesId = (moduleId: number) => `quiz-changes-${moduleId}`;

interface QuizChangesProps {
  module: ModuleAdmin;
  /** The draft has edits not saved: the AI works on the saved quiz. */
  dirty: boolean;
  /** The id of the text that says so. */
  hintId: string;
  onRequestChange: RequestQuizChange;
}

/** A change to the saved quiz to ask the AI for (or one waiting for review), and its history. */
function QuizChanges({ module, dirty, hintId, onRequestChange }: QuizChangesProps) {
  const pending = usePendingRevision(module, "quiz");
  const headingId = quizChangesId(module.id);
  // A proposal waiting can be reviewed anytime (applying it waits for the draft to be saved or discarded).
  const blocked = dirty && !pending;
  return (
    <section aria-labelledby={headingId} className="space-y-3 border-l-2 border-accent bg-accent-soft/50 px-4 py-3">
      <h3
        id={headingId}
        tabIndex={-1}
        className="text-[11px] font-bold uppercase tracking-label text-ink-700 focus-visible:ring-0"
      >
        Cambios con IA
      </h3>
      <p className="text-sm text-muted-foreground">
        {pending
          ? "Hay un cambio de la IA esperando tu revisión."
          : "Pide a la IA un ajuste puntual: propone solo lo que cambia y lo revisas antes de aplicarlo."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRequestChange()}
          disabled={blocked}
          aria-describedby={blocked ? hintId : undefined}
        >
          <Sparkles /> {pending ? "Revisar la propuesta" : "Pedir un cambio"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRequestChange({ tab: "history" })}>
          <History /> Historial de cambios
        </Button>
      </div>
      {/* Also with a proposal waiting: a question's own button asks for a new change, which waits for the draft. */}
      {dirty && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {pending
            ? "Para pedir otro cambio, primero guarda o descarta lo que editaste: la IA trabaja sobre la evaluación " +
              "guardada. La propuesta que espera ya puedes revisarla."
            : "Para pedirle un cambio a la IA, primero guarda o descarta lo que editaste: la IA trabaja sobre la " +
              "evaluación guardada."}
        </p>
      )}
    </section>
  );
}

interface EvaluationFormProps {
  module: ModuleAdmin;
  courseId: number;
  /** Null while the module has no evaluation yet. */
  evaluation: EvaluationAdmin | null;
  /** What a new one starts with (the platform's, from Parámetros): only needed while there is none. */
  defaults?: EvaluationDefaults;
  onDirtyChange: (dirty: boolean) => void;
  /** Asks the AI for a change to the saved quiz (left out: not offered). */
  onRequestChange?: RequestQuizChange;
  /** The id of why the AI can't be asked while the draft has edits (it starts from the saved quiz). */
  requestHintId: string;
}

/** Editable draft of a module's evaluation, started from what the server has saved. */
function EvaluationForm({
  module,
  courseId,
  evaluation,
  defaults,
  onDirtyChange,
  onRequestChange,
  requestHintId,
}: EvaluationFormProps) {
  const confirm = useConfirm();
  const { refreshEvaluation } = useCourseCache();
  const [questions, setQuestions] = useState<Question[]>(evaluation?.questions ?? []);
  // Suggestions are added to the draft with fresh ids (never colliding with the questions already there).
  const addSuggested = useCallback((suggested: Question[]) => {
    const stamp = Date.now().toString(36);
    setQuestions((list) =>
      [...list, ...suggested.map((question, index) => ({ ...question, id: `ai${stamp}${index}` }))].slice(0, MAX_QUESTIONS),
    );
  }, []);
  // Raw text while typing; validated below instead of clamped on every keystroke.
  const savedAttempts = String(evaluation?.max_attempts ?? defaults?.max_attempts ?? "");
  const savedScore = String(evaluation?.passing_score ?? defaults?.passing_score ?? "");
  const [maxAttempts, setMaxAttempts] = useState(savedAttempts);
  const [passingScore, setPassingScore] = useState(savedScore);
  const attempts = wholeNumberIn(maxAttempts, 1, 20);
  const score = wholeNumberIn(passingScore, 1, 100);
  const problems = questions
    .map((question, index) => ({ index, message: questionProblem(question) }))
    .filter((problem): problem is { index: number; message: string } => Boolean(problem.message));
  const problemCount = problems.length;
  const firstProblem = problems[0];

  const draft = JSON.stringify([questions, maxAttempts, passingScore]);
  const [startedFrom] = useState(draft);
  const dirty = draft !== startedFrom;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // A change asked of the AI starts from the saved quiz, and applying (or undoing) one replaces this draft.
  useUnsavedEdits({ target: "quiz", moduleId: module.id }, dirty);
  const discard = () => {
    setQuestions(evaluation?.questions ?? []);
    setMaxAttempts(savedAttempts);
    setPassingScore(savedScore);
  };

  const save = useMutation({
    mutationFn: () =>
      coursesApi.saveEvaluation(module.id, { questions, max_attempts: attempts ?? 0, passing_score: score ?? 0 }),
    onSuccess: () => {
      toast.success("Evaluación guardada");
      refreshEvaluation(courseId, module.id);
    },
    onError: toastError,
  });
  const remove = useMutation({
    mutationFn: () => coursesApi.removeEvaluation(module.id),
    onSuccess: () => {
      toast.success("Evaluación eliminada");
      refreshEvaluation(courseId, module.id);
    },
    onError: toastError,
  });

  const confirmRemove = async () => {
    const confirmed = await confirm({
      title: "¿Eliminar la evaluación?",
      description: "El módulo se completará sin examen.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (confirmed) remove.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`attempts-${module.id}`}>Intentos permitidos</Label>
          <Input
            id={`attempts-${module.id}`}
            type="number"
            min={1}
            max={20}
            value={maxAttempts}
            aria-invalid={attempts === null}
            onChange={(event) => setMaxAttempts(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`score-${module.id}`}>Puntaje para aprobar (%)</Label>
          <Input
            id={`score-${module.id}`}
            type="number"
            min={1}
            max={100}
            value={passingScore}
            aria-invalid={score === null}
            onChange={(event) => setPassingScore(event.target.value)}
          />
        </div>
      </div>

      {questions.map((question, index) => (
        <QuestionEditor
          key={question.id}
          question={question}
          index={index}
          total={questions.length}
          onChange={(next) => setQuestions((list) => replaceAt(list, index, next))}
          onRemove={() => setQuestions((list) => removeAt(list, index))}
          onMove={(direction) => setQuestions((list) => moveItem(list, index, index + direction))}
          onRequestChange={onRequestChange && (() => onRequestChange({ questionIds: [question.id] }))}
          requestBlockedBy={dirty ? requestHintId : undefined}
          // By its place, not by the question's id (a change can give it a new one): once a change is applied and the
          // draft starts over, the focus comes back to the button in the same place.
          requestButtonId={`quiz-${module.id}-question-${index + 1}-change`}
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {questions.length < MAX_QUESTIONS ? (
          <div className="flex flex-wrap items-center gap-2">
            <AddQuestionMenu onAdd={(type) => setQuestions((list) => [...list, blankQuestion(type)])} />
            <SuggestQuestionsButton
              moduleId={module.id}
              onSuggested={addSuggested}
              limit={MAX_QUESTIONS - questions.length}
              disabled={save.isPending}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Máximo {MAX_QUESTIONS} preguntas por evaluación.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {evaluation && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-red-50"
              loading={remove.isPending}
              onClick={confirmRemove}
            >
              <Trash2 /> Quitar evaluación
            </Button>
          )}
          {dirty && (
            <Button variant="ghost" onClick={discard} disabled={save.isPending}>
              Descartar cambios
            </Button>
          )}
          <Button
            onClick={() => save.mutate()}
            disabled={questions.length === 0 || problemCount > 0 || attempts === null || score === null}
            loading={save.isPending}
          >
            Guardar evaluación
          </Button>
        </div>
      </div>
      {firstProblem && (
        <p className="text-sm text-warning">
          Pregunta {firstProblem.index + 1}: {firstProblem.message.toLowerCase()}
          {problemCount > 1 ? ` (y ${problemCount - 1} más por revisar)` : ""}.
        </p>
      )}
    </div>
  );
}

/** Loads a module's evaluation (a 404 just means it has none yet) and hands it to the form. */
function ModuleEvaluation({
  module,
  courseId,
  dirty,
  onDirtyChange,
  onRequestChange,
}: {
  module: ModuleAdmin;
  courseId: number;
  /** Its draft has edits not saved. */
  dirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onRequestChange: RequestQuizChange;
}) {
  const evaluation = useQuery({
    queryKey: courseKeys.evaluation(module.id),
    queryFn: () => coursesApi.findEvaluation(module.id),
  });

  // A new one starts with the platform's defaults: the form waits for them.
  const isNew = evaluation.data === null;
  const defaults = useQuery({ queryKey: settingsKeys.all, queryFn: settingsApi.get, enabled: isNew });

  if (evaluation.isLoading || (isNew && defaults.isPending)) return <Skeleton className="h-40" />;
  if (evaluation.error) return <QueryError query={evaluation} />;
  // Unreadable, it says so: never values made up here, which saving would keep as the evaluation's own.
  if (isNew && !defaults.data) return <QueryError query={defaults} />;

  const saved = evaluation.data ?? null;
  const requestHintId = `quiz-request-${module.id}-hint`;
  return (
    <div className="space-y-4">
      {/* Outside the form: its buttons stay as the draft starts over (a change applied), and get the focus back. */}
      {saved && <QuizChanges module={module} dirty={dirty} hintId={requestHintId} onRequestChange={onRequestChange} />}
      {/* Keyed by what is saved: the draft starts over whenever the saved evaluation changes (saved, removed...). */}
      <EvaluationForm
        key={JSON.stringify(saved)}
        module={module}
        courseId={courseId}
        evaluation={saved}
        defaults={defaults.data?.evaluations}
        onDirtyChange={onDirtyChange}
        onRequestChange={saved ? onRequestChange : undefined}
        requestHintId={requestHintId}
      />
    </div>
  );
}

/** "Cambio por revisar" on a module's quiz, in its header (which opens it: its panel offers to review the change). */
function PendingQuizTag({ module }: { module: ModuleAdmin }) {
  if (!usePendingRevision(module, "quiz")) return null;
  return (
    <Badge variant="accent" className="self-start sm:self-auto">
      Cambio por revisar
    </Badge>
  );
}

export function EvaluationsTab({ course }: { course: CourseDetail }) {
  const confirm = useConfirm();
  const [openId, setOpenId] = useState<number | null>(course.modules[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  // "Pedir un cambio" to a module's quiz (or to some of its questions), and its history.
  const revisions = useRevisionSheet();

  // Leaving the page (reload, close) with unsaved questions asks first.
  useUnsavedChangesWarning(dirty);

  /** Opening or closing a module unmounts the open form: ask before discarding its draft. */
  const toggle = async (moduleId: number) => {
    if (dirty) {
      const discard = await confirm({
        title: "¿Descartar los cambios sin guardar?",
        description: "Las preguntas que no guardaste en esta evaluación se perderán.",
        confirmLabel: "Descartar",
        destructive: true,
      });
      if (!discard) return;
    }
    setDirty(false);
    setOpenId((current) => (current === moduleId ? null : moduleId));
  };

  if (!course.modules.length) {
    return <EmptyState icon={<HelpCircle />} title="Primero agrega módulos" description="Cada módulo puede tener su propia evaluación." />;
  }
  return (
    <div className="space-y-3">
      {course.modules.map((module) => {
        const expanded = openId === module.id;
        return (
          <section key={module.id} className="border border-border bg-white">
            <button
              className="flex w-full items-center gap-4 px-5 py-4 text-left"
              onClick={() => toggle(module.id)}
              aria-expanded={expanded}
            >
              <span className="shrink-0 font-display text-2xl font-medium text-accent">{twoDigits(module.order)}</span>
              {/* On a phone the summary goes under the title: side by side the title got a word per line. */}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
                <span className="min-w-0 break-words font-semibold sm:flex-1">{module.title}</span>
                <span className="text-xs text-muted-foreground">
                  {module.evaluation
                    ? `${plural(module.evaluation.question_count, "pregunta")} · aprueba con ${module.evaluation.passing_score}%`
                    : "Sin evaluación"}
                </span>
                <PendingQuizTag module={module} />
              </span>
              <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded && (
              <div className="border-t border-border bg-mist/40 p-5">
                <ModuleEvaluation
                  module={module}
                  courseId={course.id}
                  dirty={dirty}
                  onDirtyChange={setDirty}
                  onRequestChange={(options) => revisions.show({ moduleId: module.id, target: "quiz", ...options })}
                />
              </div>
            )}
          </section>
        );
      })}

      {/* Applying a change replaces the open quiz's draft: not while it has edits not saved. */}
      <RevisionSheet
        course={course}
        {...revisions.sheet}
        unsaved={dirty && openId === revisions.moduleId}
        focusFallbackId={({ moduleId }) => quizChangesId(moduleId)}
      />
    </div>
  );
}
