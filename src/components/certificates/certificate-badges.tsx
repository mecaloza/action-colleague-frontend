import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { CertificateKind, CertificateStatus, LearnerCertificate } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

const STATUS: Record<CertificateStatus, { label: string; variant: BadgeProps["variant"] }> = {
  valid: { label: "Válido", variant: "success" },
  expired: { label: "Vencido", variant: "warning" },
  revoked: { label: "Revocado", variant: "destructive" },
};

/** Whether a certificate is in force: valid, expired (past its validity) or revoked by an admin. */
export function CertificateStatusBadge({ status, className }: { status: CertificateStatus; className?: string }) {
  const { label, variant } = STATUS[status] ?? STATUS.valid;
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

export const CERTIFICATE_KIND: Record<CertificateKind, string> = {
  course: "Curso",
  path: "Ruta de aprendizaje",
};

/** "Emitido el 8 oct 2026 · Vence el 8 oct 2027" (or "Venció el…", or "No vence"; a revoked one, just its issue). */
export function certificateDates({ issued_at, expires_at, status }: Pick<LearnerCertificate, "issued_at" | "expires_at" | "status">) {
  const issued = `Emitido el ${formatDate(issued_at)}`;
  if (status === "revoked") return issued;
  const validity = !expires_at ? "No vence" : `${status === "expired" ? "Venció" : "Vence"} el ${formatDate(expires_at)}`;
  return `${issued} · ${validity}`;
}
