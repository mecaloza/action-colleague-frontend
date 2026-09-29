import type { Question, QuestionType } from "@/lib/api/types";

interface QuestionTypeInfo {
  value: QuestionType;
  label: string;
  /** Compact name for reports, when it differs from `label`. */
  short?: string;
  hint: string;
}

export const QUESTION_TYPES: QuestionTypeInfo[] = [
  { value: "single_choice", label: "Opción única", hint: "Una respuesta correcta entre varias (admite un caso)." },
  { value: "true_false", label: "Verdadero / falso", short: "V / F", hint: "Una afirmación que es cierta o falsa." },
  {
    value: "ordering",
    label: "Ordenar pasos",
    short: "Ordenar",
    hint: "Escribe los pasos en el orden correcto; se barajan al mostrarlos.",
  },
  { value: "matching", label: "Emparejar", hint: "Conceptos y definiciones; el orden no importa." },
  { value: "fill_blank", label: "Completar", hint: "Una frase con ____ y las respuestas aceptadas." },
];

/** Display name of a question type; `short` gives the compact form used in reports. */
export function questionTypeLabel(type: QuestionType, { short = false } = {}): string {
  const info = QUESTION_TYPES.find((item) => item.value === type);
  return (short && info?.short) || info?.label || type;
}

const newId = () => `q${Math.random().toString(36).slice(2, 8)}`;

export function blankQuestion(type: QuestionType): Question {
  const base = { id: newId(), prompt: "", explanation: "" };
  switch (type) {
    case "single_choice":
      return { ...base, type, scenario: "", options: ["", ""], correct_index: 0 };
    case "true_false":
      return { ...base, type, correct: true };
    case "ordering":
      return { ...base, type, items: ["", "", ""] };
    case "matching":
      return { ...base, type, pairs: [{ left: "", right: "" }, { left: "", right: "" }] };
    case "fill_blank":
      return { ...base, type, answers: [""], hint: "" };
  }
}

const hasDuplicates = (texts: string[]) => new Set(texts.map((text) => text.trim())).size < texts.length;

/** Client-side mirror of the backend validation, to show problems before saving. */
export function questionProblem(question: Question): string | null {
  if (!question.prompt.trim()) return "Falta el enunciado";
  switch (question.type) {
    case "single_choice":
      if (question.options.some((option) => !option.trim())) return "Hay opciones vacías";
      return question.options.length < 2 ? "Agrega al menos dos opciones" : null;
    case "true_false":
      return null;
    case "ordering":
      return question.items.some((item) => !item.trim()) ? "Hay pasos vacíos" : null;
    case "matching":
      if (question.pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) return "Hay parejas incompletas";
      return hasDuplicates(question.pairs.map((pair) => pair.left)) ||
        hasDuplicates(question.pairs.map((pair) => pair.right))
        ? "Hay textos repetidos"
        : null;
    case "fill_blank":
      return question.answers.some((answer) => answer.trim()) ? null : "Agrega al menos una respuesta aceptada";
  }
}
