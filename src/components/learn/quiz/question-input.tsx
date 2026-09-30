"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Choice, LearnerQuestion, QuizResponse } from "@/lib/api/types";
import { moveItem } from "@/lib/array";
import { cn } from "@/lib/utils";

interface InputProps<Q extends LearnerQuestion> {
  question: Q;
  response: QuizResponse | null;
  onChange: (response: QuizResponse) => void;
}

// The chosen answer turns solid ink; the others stay outlined.
const answerTone = (selected: boolean) =>
  selected ? "border-ink-800 bg-ink-800 text-white" : "border-input bg-white hover:border-ink-800";

const optionClass = (selected: boolean) =>
  cn("flex w-full items-center gap-4 border px-5 py-4 text-left text-base transition-colors", answerTone(selected));

function Letter({ index, selected }: { index: number; selected: boolean }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center border font-display text-sm font-semibold",
        selected ? "border-white/40 text-white" : "border-input text-muted-foreground",
      )}
    >
      {String.fromCharCode(65 + index)}
    </span>
  );
}

/** Arrow keys move the choice (and the focus) within a radiogroup, as native radio buttons do. */
function radioKeys(choose: (index: number) => void) {
  return (event: React.KeyboardEvent<HTMLElement>) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key] ?? 0;
    const radios = Array.prototype.slice.call(event.currentTarget.querySelectorAll('[role="radio"]')) as HTMLElement[];
    const from = radios.indexOf(event.target as HTMLElement);
    if (!step || from < 0) return;
    event.preventDefault();
    const next = (from + step + radios.length) % radios.length;
    choose(next);
    radios[next].focus();
  };
}

/** One tab stop per radiogroup: the chosen option, or the first while nothing is chosen. */
const rovingTab = (selected: boolean, first: boolean, anyChosen: boolean) => (selected || (!anyChosen && first) ? 0 : -1);

function SingleChoice({ question, response, onChange }: InputProps<Extract<LearnerQuestion, { type: "single_choice" }>>) {
  const chosen = response && "option" in response ? response.option : null;
  return (
    <div className="space-y-4">
      {question.scenario && (
        <p className="border-l-2 border-accent bg-white/5 px-5 py-4 text-sm leading-relaxed text-white/85">{question.scenario}</p>
      )}
      <div
        role="radiogroup"
        aria-label="Opciones"
        className="space-y-2"
        onKeyDown={radioKeys((index) => onChange({ option: question.options[index].id }))}
      >
        {question.options.map((option, index) => {
          const selected = chosen === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={rovingTab(selected, index === 0, chosen !== null)}
              onClick={() => onChange({ option: option.id })}
              className={optionClass(selected)}
            >
              <Letter index={index} selected={selected} />
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrueFalse({ response, onChange }: InputProps<Extract<LearnerQuestion, { type: "true_false" }>>) {
  const value = response && "value" in response ? response.value : null;
  return (
    <div
      role="radiogroup"
      aria-label="Verdadero o falso"
      className="grid grid-cols-2 gap-3"
      onKeyDown={radioKeys((index) => onChange({ value: index === 0 }))}
    >
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={value === option}
          tabIndex={rovingTab(value === option, option, value !== null)}
          onClick={() => onChange({ value: option })}
          className={cn(
            "h-20 border font-display text-2xl font-medium tracking-tightest transition-colors",
            answerTone(value === option),
          )}
        >
          {option ? "Verdadero" : "Falso"}
        </button>
      ))}
    </div>
  );
}

function Ordering({ question, response, onChange }: InputProps<Extract<LearnerQuestion, { type: "ordering" }>>) {
  const byId = new Map(question.items.map((item) => [item.id, item]));
  const order: Choice[] = response && "order" in response ? response.order.map((id) => byId.get(id)!).filter(Boolean) : question.items;
  const move = (from: number, to: number) => onChange({ order: moveItem(order, from, to).map((choice) => choice.id) });
  return (
    <ol className="space-y-2" aria-label="Pasos en orden">
      {order.map((item, index) => (
        <li key={item.id} className="flex items-center gap-3 border border-input bg-white px-4 py-3">
          <span className="w-6 text-center font-display text-lg font-semibold text-accent-strong">{index + 1}</span>
          <span className="flex-1">{item.text}</span>
          <Button variant="ghost" size="icon" aria-label={`Subir «${item.text}»`} disabled={index === 0} onClick={() => move(index, index - 1)}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Bajar «${item.text}»`} disabled={index === order.length - 1} onClick={() => move(index, index + 1)}>
            <ArrowDown />
          </Button>
        </li>
      ))}
    </ol>
  );
}

function Matching({ question, response, onChange }: InputProps<Extract<LearnerQuestion, { type: "matching" }>>) {
  const matches = response && "matches" in response ? response.matches : {};
  const taken = new Set(Object.values(matches));
  return (
    <ul className="space-y-3">
      {question.lefts.map((left) => (
        <li key={left.id} className="grid gap-2 border border-input bg-white p-4 sm:grid-cols-[1fr_1.2fr] sm:items-center sm:gap-4">
          <span className="font-semibold">{left.text}</span>
          <Select
            aria-label={`Pareja de «${left.text}»`}
            value={matches[left.id] ?? ""}
            onChange={(event) => {
              const next = { ...matches };
              if (event.target.value) next[left.id] = event.target.value;
              else delete next[left.id];
              onChange({ matches: next });
            }}
          >
            <option value="">Elige…</option>
            {question.rights.map((right) => (
              <option key={right.id} value={right.id} disabled={taken.has(right.id) && matches[left.id] !== right.id}>
                {right.text}
              </option>
            ))}
          </Select>
        </li>
      ))}
    </ul>
  );
}

function FillBlank({ question, response, onChange }: InputProps<Extract<LearnerQuestion, { type: "fill_blank" }>>) {
  const text = response && "text" in response ? response.text : "";
  return (
    <div className="space-y-2">
      <Input
        value={text}
        onChange={(event) => onChange({ text: event.target.value })}
        maxLength={300}
        placeholder="Tu respuesta"
        aria-label="Tu respuesta"
        className="h-14 text-lg"
        autoComplete="off"
      />
      {question.hint && <p className="text-sm text-white/70">Pista: {question.hint}</p>}
    </div>
  );
}

/** The answer control for any question type. */
export function QuestionInput(props: InputProps<LearnerQuestion>) {
  const { question } = props;
  switch (question.type) {
    case "single_choice":
      return <SingleChoice {...props} question={question} />;
    case "true_false":
      return <TrueFalse {...props} question={question} />;
    case "ordering":
      return <Ordering {...props} question={question} />;
    case "matching":
      return <Matching {...props} question={question} />;
    case "fill_blank":
      return <FillBlank {...props} question={question} />;
  }
}

/** Whether the learner answered (ordering always has an order; matching needs every pair). */
export function isAnswered(question: LearnerQuestion, response: QuizResponse | null): boolean {
  if (question.type === "ordering") return true;
  if (!response) return false;
  if ("text" in response) return response.text.trim().length > 0;
  if ("matches" in response) return question.type === "matching" && Object.keys(response.matches).length === question.lefts.length;
  return true;
}

/** What is sent for a question: ordering sends the order shown even if untouched. */
export function responseFor(question: LearnerQuestion, response: QuizResponse | null): QuizResponse | null {
  if (question.type === "ordering" && !response) return { order: question.items.map((item) => item.id) };
  return response;
}
