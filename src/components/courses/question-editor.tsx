"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Circle, GripVertical, Plus, Trash2, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  FillBlankQuestion,
  MatchingQuestion,
  Question,
  SingleChoiceQuestion,
  TrueFalseQuestion,
} from "@/lib/api/types";
import { moveItem, removeAt, replaceAt } from "@/lib/array";
import { twoDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { questionProblem, questionTypeLabel } from "./question-model";

interface FieldsProps<Q extends Question> {
  question: Q;
  onChange: (question: Question) => void;
}

function FieldCaption({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-bold uppercase tracking-label text-ink-700">{children}</p>;
}

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

function IconButton({ icon: Icon, label, disabled, onClick }: IconButtonProps) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon />
    </Button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="link" className="mt-2 text-[13px]" onClick={onClick}>
      <Plus className="h-4 w-4" /> {children}
    </Button>
  );
}

function ListField({
  label,
  values,
  onChange,
  min,
  max,
  placeholder,
  ordered = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  min: number;
  max: number;
  placeholder: (index: number) => string;
  ordered?: boolean;
}) {
  return (
    <div>
      <FieldCaption>{label}</FieldCaption>
      <ol className="space-y-2">
        {values.map((value, index) => (
          <li key={index} className="flex items-center gap-2">
            {ordered ? (
              <span className="w-6 shrink-0 text-center font-display text-sm font-semibold text-accent">{index + 1}</span>
            ) : (
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <Input
              aria-label={placeholder(index)}
              value={value}
              onChange={(event) => onChange(replaceAt(values, index, event.target.value))}
              placeholder={placeholder(index)}
            />
            {ordered && (
              <div className="flex">
                <IconButton
                  icon={ArrowUp}
                  label="Subir"
                  disabled={index === 0}
                  onClick={() => onChange(moveItem(values, index, index - 1))}
                />
                <IconButton
                  icon={ArrowDown}
                  label="Bajar"
                  disabled={index === values.length - 1}
                  onClick={() => onChange(moveItem(values, index, index + 1))}
                />
              </div>
            )}
            <IconButton
              icon={X}
              label="Quitar"
              disabled={values.length <= min}
              onClick={() => onChange(removeAt(values, index))}
            />
          </li>
        ))}
      </ol>
      {values.length < max && <AddButton onClick={() => onChange([...values, ""])}>Agregar</AddButton>}
    </div>
  );
}

/** Which option stays marked as correct once `removed` is deleted. */
function correctIndexAfterRemoving(correct: number, removed: number): number {
  if (correct === removed) return 0;
  return correct > removed ? correct - 1 : correct;
}

function SingleChoiceOptions({ question, onChange }: FieldsProps<SingleChoiceQuestion>) {
  return (
    <div>
      <FieldCaption>Opciones · marca la correcta</FieldCaption>
      <ul className="space-y-2">
        {question.options.map((option, index) => {
          const isCorrect = question.correct_index === index;
          return (
            <li key={index} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...question, correct_index: index })}
                className={cn("shrink-0 transition-colors", isCorrect ? "text-success" : "text-muted-foreground hover:text-ink-800")}
                aria-label={isCorrect ? "Respuesta correcta" : "Marcar como correcta"}
                aria-pressed={isCorrect}
              >
                {isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </button>
              <Input
                aria-label={`Opción ${index + 1}`}
                value={option}
                onChange={(event) =>
                  onChange({ ...question, options: replaceAt(question.options, index, event.target.value) })
                }
                placeholder={`Opción ${index + 1}`}
              />
              <IconButton
                icon={X}
                label="Quitar opción"
                disabled={question.options.length <= 2}
                onClick={() =>
                  onChange({
                    ...question,
                    options: removeAt(question.options, index),
                    correct_index: correctIndexAfterRemoving(question.correct_index, index),
                  })
                }
              />
            </li>
          );
        })}
      </ul>
      {question.options.length < 6 && (
        <AddButton onClick={() => onChange({ ...question, options: [...question.options, ""] })}>
          Agregar opción
        </AddButton>
      )}
    </div>
  );
}

function TrueFalseAnswer({ question, onChange }: FieldsProps<TrueFalseQuestion>) {
  return (
    <div>
      <FieldCaption>Respuesta correcta</FieldCaption>
      <div className="flex gap-2">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => onChange({ ...question, correct: value })}
            aria-pressed={question.correct === value}
            className={cn(
              "h-10 flex-1 border text-[12px] font-bold uppercase tracking-label transition-colors",
              question.correct === value ? "border-ink-800 bg-ink-800 text-white" : "border-input hover:border-ink-800",
            )}
          >
            {value ? "Verdadero" : "Falso"}
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchingPairs({ question, onChange }: FieldsProps<MatchingQuestion>) {
  const setPairs = (pairs: MatchingQuestion["pairs"]) => onChange({ ...question, pairs });
  return (
    <div>
      <FieldCaption>Parejas (concepto → definición)</FieldCaption>
      <ul className="space-y-2">
        {question.pairs.map((pair, index) => (
          <li key={index} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
            <Input
              value={pair.left}
              placeholder="Concepto"
              aria-label={`Concepto ${index + 1}`}
              onChange={(event) => setPairs(replaceAt(question.pairs, index, { ...pair, left: event.target.value }))}
            />
            <span className="text-accent">→</span>
            <Input
              value={pair.right}
              placeholder="Definición"
              aria-label={`Definición ${index + 1}`}
              onChange={(event) => setPairs(replaceAt(question.pairs, index, { ...pair, right: event.target.value }))}
            />
            <IconButton
              icon={X}
              label="Quitar pareja"
              disabled={question.pairs.length <= 2}
              onClick={() => setPairs(removeAt(question.pairs, index))}
            />
          </li>
        ))}
      </ul>
      {question.pairs.length < 8 && (
        <AddButton onClick={() => setPairs([...question.pairs, { left: "", right: "" }])}>Agregar pareja</AddButton>
      )}
    </div>
  );
}

function FillBlankFields({ question, fieldId, onChange }: FieldsProps<FillBlankQuestion> & { fieldId: string }) {
  return (
    <>
      <ListField
        label="Respuestas aceptadas (sin importar mayúsculas ni tildes)"
        values={question.answers}
        onChange={(answers) => onChange({ ...question, answers })}
        min={1}
        max={5}
        placeholder={(i) => (i === 0 ? "Respuesta principal" : "Variante aceptada")}
      />
      <div>
        <Label htmlFor={`${fieldId}-hint`}>Pista (opcional)</Label>
        <Input
          id={`${fieldId}-hint`}
          value={question.hint}
          onChange={(event) => onChange({ ...question, hint: event.target.value })}
          placeholder="Empieza con…"
        />
      </div>
    </>
  );
}

/** The part of the editor that depends on the question type. */
function TypeFields({ question, fieldId, onChange }: FieldsProps<Question> & { fieldId: string }) {
  switch (question.type) {
    case "single_choice":
      return <SingleChoiceOptions question={question} onChange={onChange} />;
    case "true_false":
      return <TrueFalseAnswer question={question} onChange={onChange} />;
    case "ordering":
      return (
        <ListField
          label="Pasos en el orden correcto"
          values={question.items}
          onChange={(items) => onChange({ ...question, items })}
          min={2}
          max={8}
          ordered
          placeholder={(i) => `Paso ${i + 1}`}
        />
      );
    case "matching":
      return <MatchingPairs question={question} onChange={onChange} />;
    case "fill_blank":
      return <FillBlankFields question={question} fieldId={fieldId} onChange={onChange} />;
  }
}

export function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  question: Question;
  index: number;
  total: number;
  onChange: (question: Question) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const fieldId = `question-${useId()}`;
  const problem = questionProblem(question);

  return (
    <article className={cn("border bg-white", problem ? "border-amber-300" : "border-border")}>
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <span className="font-display text-lg font-semibold text-accent">{twoDigits(index + 1)}</span>
        <span className="text-[11px] font-bold uppercase tracking-label text-muted-foreground">
          {questionTypeLabel(question.type)}
        </span>
        {problem && <span className="text-xs font-semibold text-warning">· {problem}</span>}
        <div className="ml-auto flex items-center">
          <IconButton icon={ArrowUp} label="Subir pregunta" disabled={index === 0} onClick={() => onMove(-1)} />
          <IconButton icon={ArrowDown} label="Bajar pregunta" disabled={index === total - 1} onClick={() => onMove(1)} />
          <IconButton icon={Trash2} label="Eliminar pregunta" onClick={onRemove} />
        </div>
      </header>

      <div className="space-y-5 p-5">
        {question.type === "single_choice" && (
          <div>
            <Label htmlFor={`${fieldId}-scenario`}>Caso (opcional)</Label>
            <Textarea
              id={`${fieldId}-scenario`}
              value={question.scenario}
              onChange={(event) => onChange({ ...question, scenario: event.target.value })}
              placeholder="Describe una situación del trabajo…"
              className="min-h-[72px]"
            />
          </div>
        )}

        <div>
          <Label htmlFor={`${fieldId}-prompt`}>{question.type === "true_false" ? "Afirmación" : "Enunciado"}</Label>
          <Input
            id={`${fieldId}-prompt`}
            value={question.prompt}
            onChange={(event) => onChange({ ...question, prompt: event.target.value })}
            placeholder={question.type === "fill_blank" ? "La _____ es clave para…" : "Escribe la pregunta"}
          />
        </div>

        <TypeFields question={question} fieldId={fieldId} onChange={onChange} />

        <div>
          <Label htmlFor={`${fieldId}-explanation`}>Explicación para después de responder (opcional)</Label>
          <Textarea
            id={`${fieldId}-explanation`}
            value={question.explanation}
            onChange={(event) => onChange({ ...question, explanation: event.target.value })}
            className="min-h-[64px]"
            placeholder="Por qué esta es la respuesta correcta…"
          />
        </div>
      </div>
    </article>
  );
}
