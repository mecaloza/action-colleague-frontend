import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AttemptDetail } from "@/lib/api/types";
import { formatDate, formatPercent } from "@/lib/format";

/** One attempt at a quiz: passed or not with its score, when, and each question right or wrong. */
export function AttemptCard({ attempt }: { attempt: AttemptDetail }) {
  return (
    <li className="border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">Intento {attempt.attempt_number}</span>
        <Badge variant={attempt.passed ? "success" : "destructive"}>
          {attempt.passed ? "Aprobado" : "No aprobado"} · {formatPercent(attempt.score)}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{formatDate(attempt.created_at)}</p>
      <ul className="space-y-1.5 text-sm">
        {attempt.results.map((result) => (
          <li key={result.question_id} className="flex items-start gap-2">
            {result.correct ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" role="img" aria-label="Correcta" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" role="img" aria-label="Incorrecta" />
            )}
            <span className="min-w-0 break-words">{result.prompt || "Pregunta"}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}
