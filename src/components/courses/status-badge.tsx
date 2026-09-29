import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { CourseStatus, EnrollmentStatus } from "@/lib/api/types";

interface StatusStyle {
  label: string;
  variant: BadgeProps["variant"];
}

// Course badges also sit over dark covers and headers, hence `inverse` for archived.
const COURSE_STATUS: Record<CourseStatus, StatusStyle> = {
  published: { label: "Publicado", variant: "success" },
  draft: { label: "Borrador", variant: "secondary" },
  archived: { label: "Archivado", variant: "inverse" },
};

const ENROLLMENT_STATUS: Record<EnrollmentStatus, StatusStyle> = {
  assigned: { label: "Asignado", variant: "secondary" },
  in_progress: { label: "En curso", variant: "accent" },
  completed: { label: "Completado", variant: "success" },
};

export function StatusBadge({ status }: { status: CourseStatus }) {
  const { label, variant } = COURSE_STATUS[status] ?? COURSE_STATUS.draft;
  return <Badge variant={variant}>{label}</Badge>;
}

export function EnrollmentBadge({ status }: { status: EnrollmentStatus }) {
  const { label, variant } = ENROLLMENT_STATUS[status] ?? ENROLLMENT_STATUS.assigned;
  return <Badge variant={variant}>{label}</Badge>;
}
