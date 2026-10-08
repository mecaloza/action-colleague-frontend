"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { AttemptCard } from "@/components/people/attempt-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { Participant } from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";

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
        {/* Their page opens on this course: every course, path, certificate and the latest things they did. */}
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href={`/admin/team/${participant.user.id}?course=${courseId}`}>
            Ver ficha completa <ArrowRight />
          </Link>
        </Button>
      </SheetHeader>
      <SheetBody className="space-y-6">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span>
              {participant.completed_modules} de {plural(participant.total_modules, "módulo")}
            </span>
            <span className="font-semibold">{formatPercent(participant.progress_pct)}</span>
          </div>
          <Progress value={participant.progress_pct} />
        </div>
        {attempts.isLoading && <Skeleton className="h-32" />}
        {attempts.error && <QueryError query={attempts} />}
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
