"use client";

import { Check } from "lucide-react";
import { questionTypeLabel } from "@/components/courses/question-model";
import type { QuestionChange, QuestionType, RevisionChanges, RevisionLearners } from "@/lib/api/types";
import {
  Blank,
  CardNumber,
  ChangeCard,
  ChangeReason,
  changedFields,
  changeLooks,
  ChangesSection,
  Compare,
  FieldDiff,
  listOf,
  NotesPanel,
  PositionNote,
  recordOf,
  textOf,
} from "./revision-diff";

const LOOKS = changeLooks("Pregunta nueva");

/** A question's fields in the order its editor shows them, named as there. */
const FIELDS: [name: string, label: string][] = [
  ["type", "Tipo de pregunta"],
  ["scenario", "Caso"],
  ["prompt", "Enunciado"],
  ["options", "Opciones"],
  ["correct_index", "Respuesta correcta"],
  ["correct", "Respuesta correcta"],
  ["items", "Pasos en el orden correcto"],
  ["pairs", "Parejas"],
  ["answers", "Respuestas aceptadas"],
  ["hint", "Pista"],
  ["explanation", "Explicación"],
];
const FIELD_LABELS = new Map(FIELDS);

/** A question as the server stores it: read without trusting its shape. */
type StoredQuestion = Record<string, unknown>;

/** A field's name as its editor shows it (a true/false question's prompt is a statement). */
function fieldLabel(name: string, question: StoredQuestion | null): string {
  if (name === "prompt" && question?.type === "true_false") return "Afirmación";
  return FIELD_LABELS.get(name) ?? name;
}

function TextList({ items, ordered }: { items: string[]; ordered: boolean }) {
  if (!items.length) return <Blank />;
  const List = ordered ? "ol" : "ul";
  return (
    <List className={ordered ? "list-decimal space-y-0.5 pl-5" : "list-disc space-y-0.5 pl-5"}>
      {items.map((item, index) => (
        <li key={index}>{item.trim() || <Blank />}</li>
      ))}
    </List>
  );
}

/** A field's value as the editor shows it. `question`: the whole question it is part of (its options, the right one). */
function QuestionValue({ name, value, question }: { name: string; value: unknown; question: StoredQuestion | null }) {
  switch (name) {
    case "type":
      return <>{questionTypeLabel(textOf(value) as QuestionType)}</>;
    case "options": {
      const options = listOf(value);
      if (!options.length) return <Blank />;
      return (
        <ol className="list-decimal space-y-0.5 pl-5">
          {options.map((option, index) => (
            <li key={index}>
              {option.trim() || <Blank />}
              {index === question?.correct_index && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-success">
                  <Check className="h-3.5 w-3.5" aria-hidden /> correcta
                </span>
              )}
            </li>
          ))}
        </ol>
      );
    }
    case "correct_index": {
      const options = listOf(question?.options);
      const index = typeof value === "number" ? value : -1;
      if (options[index] === undefined) return <Blank />;
      return (
        <>
          Opción {index + 1}: {options[index].trim() || <Blank />}
        </>
      );
    }
    case "correct":
      return typeof value === "boolean" ? <>{value ? "Verdadero" : "Falso"}</> : <Blank />;
    case "items":
      return <TextList items={listOf(value)} ordered />;
    case "answers":
      return <TextList items={listOf(value)} ordered={false} />;
    case "pairs": {
      const pairs = Array.isArray(value) ? value.map(recordOf) : [];
      if (!pairs.length) return <Blank />;
      return (
        <ul className="space-y-0.5">
          {pairs.map((pair, index) => (
            <li key={index}>
              {textOf(pair.left) || <Blank />} → {textOf(pair.right) || <Blank />}
            </li>
          ))}
        </ul>
      );
    }
    default:
      return <span className="whitespace-pre-wrap">{textOf(value) || <Blank />}</span>;
  }
}

const isEmpty = (value: unknown) => value === "" || value === null || (Array.isArray(value) && !value.length);

/** A question added or removed, whole: every field it has, as the editor shows them (the right option marked). */
function WholeQuestion({ question }: { question: StoredQuestion }) {
  const names = FIELDS.map(([name]) => name).filter(
    (name) => name !== "correct_index" && name in question && !isEmpty(question[name]),
  );
  return (
    <dl className="space-y-2">
      {names.map((name) => (
        <div key={name}>
          <dt className="text-[10px] font-bold uppercase tracking-label text-muted-foreground">
            {fieldLabel(name, question)}
          </dt>
          <dd>
            <QuestionValue name={name} value={question[name]} question={question} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function QuestionChangeCard({ change }: { change: QuestionChange }) {
  const { action, position, fields } = change;
  const number = position.after ?? position.before ?? 0;
  const before = change.before as StoredQuestion | null;
  const after = change.after as StoredQuestion | null;
  const names = changedFields(fields, FIELDS);
  // What is answered changed: to the results it is a new question (the answers to the old one stay with it).
  const renewed = action === "update" && before !== null && after !== null && before.id !== after.id;
  return (
    <ChangeCard
      marker={<CardNumber number={number} />}
      title={
        <>
          <span className="sr-only">Pregunta {number}: </span>
          {textOf((after ?? before)?.prompt) || "Pregunta sin enunciado"}
        </>
      }
      look={LOOKS[action] ?? LOOKS.update}
    >
      <ChangeReason reason={change.reason} />
      <PositionNote action={action} position={position} noun="pregunta" />
      {renewed && (
        <p className="text-sm">
          Cambia lo que se responde: sus resultados empiezan de cero y las respuestas que ya se dieron quedan con la
          versión anterior.
        </p>
      )}
      {action === "insert" || action === "delete" ? (
        <Compare
          before={action === "delete" && before ? <WholeQuestion question={before} /> : undefined}
          after={action === "insert" && after ? <WholeQuestion question={after} /> : undefined}
        />
      ) : (
        names.map((name) => (
          <FieldDiff key={name} label={fieldLabel(name, after ?? before)}>
            <Compare
              before={<QuestionValue name={name} value={fields[name].before} question={before} />}
              after={<QuestionValue name={name} value={fields[name].after} question={after} />}
            />
          </FieldDiff>
        ))
      )}
    </ChangeCard>
  );
}

/** What a change does to the module's quiz, question by question: its fields before and after, or the whole question. */
export function QuizRevisionDiff({ changes }: { changes: RevisionChanges }) {
  return (
    <ChangesSection>
      {changes.questions.map((change) => (
        <QuestionChangeCard key={`${change.action}:${change.question_id}`} change={change} />
      ))}
    </ChangesSection>
  );
}

/** Only explanations change: what learners answer stays the same (their answers keep counting). */
const explanationsOnly = (changes: RevisionChanges) =>
  changes.questions.length > 0 &&
  changes.questions.every(
    (change) => change.action === "update" && Object.keys(change.fields).every((name) => name === "explanation"),
  );

interface QuizReachPanelProps {
  changes: RevisionChanges;
  /** Who it reaches, as the server counts them (left out by an older one: then the course's status says it). */
  learners: RevisionLearners | null;
  coursePublished: boolean;
}

/** Who the change reaches as soon as it is applied, in plain Spanish (one sentence per line). */
function reachLines({ changes, learners, coursePublished }: QuizReachPanelProps): string[] {
  const lines = [
    (learners?.published ?? coursePublished)
      ? "El curso está publicado: quienes lo toman ven la evaluación nueva en cuanto apliques el cambio."
      : "El curso no está publicado: nadie ve el cambio hasta que lo publiques.",
  ];
  const trying = learners?.mid_quiz ?? 0;
  if (trying === 1) {
    lines.push("1 persona ya intentó la evaluación sin aprobarla: su próximo intento será con las preguntas nuevas.");
  } else if (trying > 1) {
    lines.push(
      `${trying} personas ya intentaron la evaluación sin aprobarla: su próximo intento será con las preguntas nuevas.`,
    );
  }
  if (explanationsOnly(changes)) lines.push("Solo cambian explicaciones: lo que ya se respondió sigue valiendo.");
  return lines;
}

/** What the change means for the people taking the course: when they see it, and who is in the middle of the quiz. */
export function QuizReachPanel(props: QuizReachPanelProps) {
  return <NotesPanel title="Para las personas" lines={reachLines(props)} />;
}
