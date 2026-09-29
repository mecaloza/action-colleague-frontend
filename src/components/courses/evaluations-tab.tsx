"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, HelpCircle, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { QueryError } from "@/components/layout/query-state";
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
import { ApiError } from "@/lib/api/client";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { CourseDetail, EvaluationAdmin, ModuleAdmin, Question, QuestionType } from "@/lib/api/types";
import { moveItem, removeAt, replaceAt } from "@/lib/array";
import { plural, twoDigits } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { QuestionEditor } from "./question-editor";
import { QUESTION_TYPES, blankQuestion, questionProblem } from "./question-model";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_PASSING_SCORE = 70;
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

interface EvaluationFormProps {
  module: ModuleAdmin;
  courseId: number;
  /** Null while the module has no evaluation yet. */
  evaluation: EvaluationAdmin | null;
  onDirtyChange: (dirty: boolean) => void;
}

/** Editable draft of a module's evaluation, started from what the server has saved. */
function EvaluationForm({ module, courseId, evaluation, onDirtyChange }: EvaluationFormProps) {
  const confirm = useConfirm();
  const { refreshEvaluation } = useCourseCache();
  const [questions, setQuestions] = useState<Question[]>(evaluation?.questions ?? []);
  // Raw text while typing; validated below instead of clamped on every keystroke.
  const [maxAttempts, setMaxAttempts] = useState(String(evaluation?.max_attempts ?? DEFAULT_MAX_ATTEMPTS));
  const [passingScore, setPassingScore] = useState(String(evaluation?.passing_score ?? DEFAULT_PASSING_SCORE));
  const attempts = wholeNumberIn(maxAttempts, 1, 20);
  const score = wholeNumberIn(passingScore, 1, 100);
  const problemCount = questions.filter((question) => questionProblem(question)).length;

  const draft = JSON.stringify([questions, maxAttempts, passingScore]);
  const [startedFrom] = useState(draft);
  const dirty = draft !== startedFrom;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

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
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {questions.length < MAX_QUESTIONS ? (
          <AddQuestionMenu onAdd={(type) => setQuestions((list) => [...list, blankQuestion(type)])} />
        ) : (
          <p className="text-sm text-muted-foreground">Máximo {MAX_QUESTIONS} preguntas por evaluación.</p>
        )}
        <div className="flex items-center gap-2">
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
          <Button
            onClick={() => save.mutate()}
            disabled={questions.length === 0 || problemCount > 0 || attempts === null || score === null}
            loading={save.isPending}
          >
            Guardar evaluación
          </Button>
        </div>
      </div>
      {problemCount > 0 && (
        <p className="text-sm text-warning">
          {problemCount === 1 ? "Revisa la pregunta marcada" : `Revisa las ${problemCount} preguntas marcadas`} antes de
          guardar.
        </p>
      )}
    </div>
  );
}

/** Loads a module's evaluation (a 404 just means it has none yet) and hands it to the form. */
function ModuleEvaluation({
  module,
  courseId,
  onDirtyChange,
}: {
  module: ModuleAdmin;
  courseId: number;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const evaluation = useQuery({
    queryKey: courseKeys.evaluation(module.id),
    queryFn: async () => {
      try {
        return await coursesApi.getEvaluation(module.id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

  if (evaluation.isLoading) return <Skeleton className="h-40" />;
  if (evaluation.error) return <QueryError query={evaluation} />;

  // Keyed by what is saved: the draft starts over whenever the saved evaluation changes (saved, removed...).
  const saved = evaluation.data ?? null;
  return (
    <EvaluationForm
      key={JSON.stringify(saved)}
      module={module}
      courseId={courseId}
      evaluation={saved}
      onDirtyChange={onDirtyChange}
    />
  );
}

export function EvaluationsTab({ course }: { course: CourseDetail }) {
  const confirm = useConfirm();
  const [openId, setOpenId] = useState<number | null>(course.modules[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);

  // Leaving the page (reload, close) with unsaved questions asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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
              <span className="font-display text-2xl font-medium text-accent">{twoDigits(module.order)}</span>
              <span className="flex-1 font-semibold">{module.title}</span>
              <span className="text-xs text-muted-foreground">
                {module.evaluation
                  ? `${plural(module.evaluation.question_count, "pregunta")} · aprueba con ${module.evaluation.passing_score}%`
                  : "Sin evaluación"}
              </span>
              <ChevronDown className={cn("h-5 w-5 transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded && (
              <div className="border-t border-border bg-mist/40 p-5">
                <ModuleEvaluation module={module} courseId={course.id} onDirtyChange={setDirty} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
