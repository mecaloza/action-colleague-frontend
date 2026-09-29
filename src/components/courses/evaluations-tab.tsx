"use client";

import { useState } from "react";
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

/** Number typed in a field, kept within [min, max]; `fallback` when it is not a number. */
function clampedNumber(raw: string, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, Number(raw) || fallback));
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
}

/** Editable draft of a module's evaluation, started from what the server has saved. */
function EvaluationForm({ module, courseId, evaluation }: EvaluationFormProps) {
  const confirm = useConfirm();
  const { refreshEvaluation } = useCourseCache();
  const [questions, setQuestions] = useState<Question[]>(evaluation?.questions ?? []);
  const [maxAttempts, setMaxAttempts] = useState(evaluation?.max_attempts ?? DEFAULT_MAX_ATTEMPTS);
  const [passingScore, setPassingScore] = useState(evaluation?.passing_score ?? DEFAULT_PASSING_SCORE);
  const problemCount = questions.filter((question) => questionProblem(question)).length;

  const save = useMutation({
    mutationFn: () =>
      coursesApi.saveEvaluation(module.id, { questions, max_attempts: maxAttempts, passing_score: passingScore }),
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
            onChange={(event) => setMaxAttempts(clampedNumber(event.target.value, 1, 20, 1))}
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
            onChange={(event) => setPassingScore(clampedNumber(event.target.value, 1, 100, DEFAULT_PASSING_SCORE))}
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
        <AddQuestionMenu onAdd={(type) => setQuestions((list) => [...list, blankQuestion(type)])} />
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
            disabled={questions.length === 0 || problemCount > 0}
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
function ModuleEvaluation({ module, courseId }: { module: ModuleAdmin; courseId: number }) {
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
  return <EvaluationForm key={JSON.stringify(saved)} module={module} courseId={courseId} evaluation={saved} />;
}

export function EvaluationsTab({ course }: { course: CourseDetail }) {
  const [openId, setOpenId] = useState<number | null>(course.modules[0]?.id ?? null);
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
              onClick={() => setOpenId(expanded ? null : module.id)}
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
                <ModuleEvaluation module={module} courseId={course.id} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
