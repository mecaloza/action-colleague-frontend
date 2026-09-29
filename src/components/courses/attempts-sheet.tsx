"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { AttemptDetail, Participant } from "@/lib/api/types";
import { formatDate, formatPercent } from "@/lib/format";

function AttemptCard({ attempt }: { attempt: AttemptDetail }) {
  return (
    <li className="border border-border p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">Intento {attempt.attempt_number}</span>
        <Badge variant={attempt.passed ? "success" : "destructive"}>
          {attempt.passed ? "Aprobado" : "No aprobado"} · {formatPercent(attempt.score ?? 0)}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{formatDate(attempt.created_at)}</p>
      <ul className="space-y-1.5 text-sm">
        {attempt.results.map((result) => (
          <li key={result.question_id} className="flex items-start gap-2">
            {result.correct ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <span>{result.prompt || "Pregunta"}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function ParticipantDetail({ courseId, participant }: { courseId: number; participant: Participant }) {
  const attempts = useQuery({
    queryKey: courseKeys.attempts(courseId, participant.user.id),
    queryFn: () => coursesApi.participantAttempts(courseId, participant.user.id),
  });

  return (
    <>
      <SheetHeader>
        <p className="eyebrow mb-2">Detalle</p>
        <SheetTitle className="font-display text-2xl font-medium tracking-tightest">{participant.user.name}</SheetTitle>
        <p className="text-sm text-muted-foreground">{participant.user.email}</p>
      </SheetHeader>
      <SheetBody className="space-y-6">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span>
              {participant.completed_modules} de {participant.total_modules} módulos
            </span>
            <span className="font-semibold">{formatPercent(participant.progress_pct)}</span>
          </div>
          <Progress value={participant.progress_pct} />
        </div>
        {attempts.isLoading && <Skeleton className="h-32" />}
        {attempts.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no ha presentado evaluaciones.</p>
        )}
        {attempts.data?.map((module) => (
          <section key={module.module_id}>
            <h3 className="mb-3 font-semibold">{module.module_title}</h3>
            <ol className="space-y-3">
              {module.attempts.map((attempt) => (
                <AttemptCard key={attempt.attempt_number} attempt={attempt} />
              ))}
            </ol>
          </section>
        ))}
      </SheetBody>
    </>
  );
}

/** Side panel with one participant's progress and every evaluation attempt. */
export function AttemptsSheet({
  courseId,
  participant,
  onClose,
}: {
  courseId: number;
  participant: Participant | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={participant !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-w-xl">
        {participant && <ParticipantDetail courseId={courseId} participant={participant} />}
      </SheetContent>
    </Sheet>
  );
}
