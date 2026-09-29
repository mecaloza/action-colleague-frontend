"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type QuizSuggestion, studioApi } from "@/lib/api/studio";
import type { Question } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { isActiveJob, useJob } from "@/lib/hooks/use-jobs";
import { useStudioCapabilities } from "@/lib/hooks/use-studio-capabilities";
import { toastError } from "@/lib/notify";

interface SuggestQuestionsButtonProps {
  moduleId: number;
  /** The suggested questions, to add to the draft (nothing is saved until the admin saves). */
  onSuggested: (questions: Question[]) => void;
  /** How many more questions the evaluation can take. */
  limit: number;
  disabled?: boolean;
}

/** Asks the AI for questions based on the module's content (reading, script, transcript or document). */
export function SuggestQuestionsButton({ moduleId, onSuggested, limit, disabled }: SuggestQuestionsButtonProps) {
  const { ai } = useStudioCapabilities();
  const [jobId, setJobId] = useState<string | null>(null);
  const { data: job } = useJob(jobId);
  const start = useMutation({
    mutationFn: () => studioApi.suggestQuiz(moduleId),
    onSuccess: (created) => setJobId(created.id),
    onError: toastError,
  });

  // The job ended: hand over its questions (or say why there are none) and let the button be used again.
  useEffect(() => {
    if (!job || isActiveJob(job)) return;
    const suggested = job.status === "succeeded" ? ((job.result as QuizSuggestion | null)?.questions ?? []) : [];
    const added = suggested.slice(0, Math.max(0, limit));
    if (added.length) {
      onSuggested(added);
      toast.success(
        added.length < suggested.length
          ? `Se agregaron ${added.length} de las ${suggested.length} preguntas sugeridas: la evaluación llegó al máximo. Revísalas antes de guardar.`
          : `La IA sugirió ${plural(added.length, "pregunta")}. Revísalas antes de guardar.`,
      );
    } else {
      toast.error(job.error || "La IA no pudo sugerir preguntas con este contenido.");
    }
    setJobId(null);
  }, [job, limit, onSuggested]);

  if (!ai) return null;
  return (
    <Button
      variant="outline"
      onClick={() => start.mutate()}
      loading={start.isPending || Boolean(jobId)}
      disabled={disabled}
    >
      <Sparkles /> Sugerir con IA
    </Button>
  );
}
