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
      return { ...base, type, scenario: "", options: ["", ""], correct_index: -1 }; // the admin marks it
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

// Same rules as the backend: repeats ignore case, and accepted answers need a letter or digit.
const hasDuplicates = (texts: string[]) => new Set(texts.map((text) => text.trim().toLowerCase())).size < texts.length;
// Digits and Latin letters, accents included (× and ÷ sit in that block but are symbols).
const hasWordCharacters = (text: string) => /[0-9A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F]/.test(text);

/** Client-side mirror of the backend validation, to show problems before saving. */
export function questionProblem(question: Question): string | null {
  if (!question.prompt.trim()) return "Falta el enunciado";
  switch (question.type) {
    case "single_choice":
      if (question.options.some((option) => !option.trim())) return "Hay opciones vacías";
      if (question.options.length < 2) return "Agrega al menos dos opciones";
      if (hasDuplicates(question.options)) return "Hay opciones repetidas";
      return question.correct_index >= 0 && question.correct_index < question.options.length
        ? null
        : "Marca la respuesta correcta";
    case "true_false":
      return null;
    case "ordering":
      if (question.items.some((item) => !item.trim())) return "Hay pasos vacíos";
      return hasDuplicates(question.items) ? "Hay pasos repetidos" : null;
    case "matching":
      if (question.pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) return "Hay parejas incompletas";
      return hasDuplicates(question.pairs.map((pair) => pair.left)) ||
        hasDuplicates(question.pairs.map((pair) => pair.right))
        ? "Hay textos repetidos"
        : null;
    case "fill_blank":
      return question.answers.some(hasWordCharacters) ? null : "Agrega al menos una respuesta aceptada";
  }
}
