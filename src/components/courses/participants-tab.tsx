"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { QueryError } from "@/components/layout/query-state";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { CourseDetail, Participant } from "@/lib/api/types";
import { formatPercent, formatRelative } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { AssignDialog } from "./assign-dialog";
import { AttemptsSheet } from "./attempts-sheet";
import { EnrollmentBadge } from "./status-badge";

interface ParticipantRowProps {
  participant: Participant;
  onOpen: () => void;
  onRemove: () => void;
}

function ParticipantRow({ participant, onOpen, onRemove }: ParticipantRowProps) {
  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell>
        {/* The row opens on click; this button is the way in for keyboards and screen readers. */}
        <button
          type="button"
          className="text-left font-semibold hover:text-accent"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          aria-label={`Ver el detalle de ${participant.user.name}`}
        >
          {participant.user.name}
        </button>
        <p className="text-xs text-muted-foreground">{participant.user.department || participant.user.email}</p>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <EnrollmentBadge status={participant.status} />
      </TableCell>
      <TableCell>
        <div className="flex min-w-[96px] items-center gap-3">
          <Progress value={participant.progress_pct} className="flex-1" />
          <span className="w-10 text-right text-xs font-semibold">{formatPercent(participant.progress_pct)}</span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">{formatPercent(participant.average_score)}</TableCell>
      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
        {participant.last_activity_at ? formatRelative(participant.last_activity_at) : "Sin actividad"}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Retirar a ${participant.user.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <UserMinus />
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface ParticipantsTableProps {
  participants: Participant[];
  onOpen: (participant: Participant) => void;
  onRemove: (participant: Participant) => void;
}

function ParticipantsTable({ participants, onOpen, onRemove }: ParticipantsTableProps) {
  return (
    <div className="border border-border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead className="hidden sm:table-cell">Estado</TableHead>
            <TableHead className="w-48">Avance</TableHead>
            <TableHead className="hidden md:table-cell">Promedio</TableHead>
            <TableHead className="hidden lg:table-cell">Última actividad</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((participant) => (
            <ParticipantRow
              key={participant.enrollment_id}
              participant={participant}
              onOpen={() => onOpen(participant)}
              onRemove={() => onRemove(participant)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ParticipantsTab({ course }: { course: CourseDetail }) {
  const confirm = useConfirm();
  const { refreshCourse } = useCourseCache();
  const [assigning, setAssigning] = useState(false);
  const [inspected, setInspected] = useState<Participant | null>(null);
  const participants = useQuery({
    queryKey: courseKeys.participants(course.id),
    queryFn: () => coursesApi.participants(course.id),
  });

  const remove = useMutation({
    mutationFn: (userId: number) => coursesApi.removeParticipant(course.id, userId),
    onSuccess: () => {
      refreshCourse(course.id);
      toast.success("Persona retirada del curso");
    },
    onError: toastError,
  });

  const confirmRemove = async (participant: Participant) => {
    const confirmed = await confirm({
      title: `¿Retirar a ${participant.user.name}?`,
      description: "Se borrará su progreso en este curso.",
      confirmLabel: "Retirar",
      destructive: true,
    });
    if (confirmed) remove.mutate(participant.user.id);
  };

  const enrolledIds = new Set((participants.data ?? []).map((p) => p.user.id));

  const assignButton = (
    <Button onClick={() => setAssigning(true)}>
      <UserPlus /> Asignar personas
    </Button>
  );

  return (
    <div>
      <SectionHeader title="Participantes" description="Quiénes toman el curso y cómo van." action={assignButton} />

      {participants.isLoading ? (
        <Skeleton className="h-48" />
      ) : participants.error ? (
        <QueryError query={participants} />
      ) : participants.data?.length ? (
        <ParticipantsTable participants={participants.data} onOpen={setInspected} onRemove={confirmRemove} />
      ) : (
        <EmptyState
          icon={<Users />}
          title="Nadie toma este curso todavía"
          description="Asigna a las personas de tu equipo que deben completarlo."
          action={assignButton}
        />
      )}

      <AssignDialog course={course} enrolledIds={enrolledIds} open={assigning} onOpenChange={setAssigning} />
      <AttemptsSheet courseId={course.id} participant={inspected} onClose={() => setInspected(null)} />
    </div>
  );
}
