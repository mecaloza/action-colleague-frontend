"use client";

import { toast } from "sonner";
import { PickPeopleDialog } from "@/components/team/pick-people-dialog";
import { coursesApi } from "@/lib/api/courses";
import type { CourseDetail } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";

interface AssignDialogProps {
  course: CourseDetail;
  /** People already in the course: they are not offered again. */
  enrolledIds: Set<number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignDialog({ course, enrolledIds, open, onOpenChange }: AssignDialogProps) {
  const { storeParticipants } = useCourseCache();
  return (
    <PickPeopleDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Asignar personas"
      description={`Verán el curso en «Mis cursos» ${course.status === "published" ? "de inmediato" : "cuando lo publiques"}.`}
      excludedIds={enrolledIds}
      assign={(userIds) => coursesApi.addParticipants(course.id, userIds)}
      onAssigned={(participants, count) => {
        storeParticipants(course.id, participants);
        toast.success(count === 1 ? "Persona asignada" : `${count} personas asignadas`);
      }}
    />
  );
}
