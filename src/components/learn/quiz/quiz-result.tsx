"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import type { AttemptResult, Choice, LearnerQuestion } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

function ScoreRing({ score, passed }: { score: number; passed: boolean }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="10" className="stroke-white/15" />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="butt"
          className={passed ? "stroke-accent" : "stroke-white/70"}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - Math.min(score, 100) / 100) }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-4xl font-medium text-white">
        {formatPercent(score)}
      </span>
    </div>
  );
}

const textOf = (choices: Choice[], id: unknown) => choices.find((choice) => choice.id === id)?.text;

/** The solution in words, when the API sends it (only once the quiz is passed). */
function solutionText(question: LearnerQuestion, expected: unknown): string | null {
  if (expected === null || expected === undefined) return null;
  switch (question.type) {
    case "single_choice":
      return textOf(question.options, expected) ?? null;
    case "true_false":
      return expected ? "Verdadero" : "Falso";
    case "ordering":
      return Array.isArray(expected)
        ? expected.map((id, index) => `${index + 1}. ${textOf(question.items, id) ?? ""}`).join("  ")
        : null;
    case "matching":
      return typeof expected === "object"
        ? Object.entries(expected as Record<string, string>)
            .map(([left, right]) => `${textOf(question.lefts, left) ?? "?"} → ${textOf(question.rights, right) ?? "?"}`)
            .join(" · ")
        : null;
    case "fill_blank":
      return typeof expected === "string" ? expected : null;
  }
}

interface QuizResultProps {
  result: AttemptResult;
  questions: LearnerQuestion[];
  passingScore: number;
}

export function QuizResult({ result, questions, passingScore }: QuizResultProps) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return (
    <div className="space-y-10">
      <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <ScoreRing score={result.score} passed={result.passed} />
        <div>
          <p className="eyebrow mb-2 text-white/60">{result.passed ? "Evaluación aprobada" : "Resultado"}</p>
          <h3 className="display-md text-white">{result.passed ? "¡Aprobaste!" : "Aún no alcanzas el puntaje"}</h3>
          <p className="mt-2 text-white/70">
            {result.correct} de {result.total} correctas · se aprueba con {passingScore}%
          </p>
        </div>
      </div>
      <ol className="space-y-2">
        {result.results.map((item, index) => {
          const question = byId.get(item.question_id);
          if (!question) return null;
          const solution = item.correct ? null : solutionText(question, item.expected);
          return (
            <li key={item.question_id} className={cn("border-l-2 bg-white/5 px-5 py-4", item.correct ? "border-success" : "border-destructive")}>
              <p className="flex items-start gap-3 text-white">
                {item.correct ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label="Correcta" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-label="Incorrecta" />
                )}
                <span>
                  <span className="mr-2 font-display text-white/50">{index + 1}.</span>
                  {question.prompt}
                </span>
              </p>
              {solution && <p className="mt-2 pl-8 text-sm text-white/80">Respuesta correcta: {solution}</p>}
              {item.explanation && <p className="mt-2 pl-8 text-sm text-white/60">{item.explanation}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
