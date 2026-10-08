import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { CertificateKind, CertificateStatus, LearnerCertificate } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { safeHttpUrl } from "@/lib/safe-url";

interface StatusLook {
  label: string;
  variant: BadgeProps["variant"];
}

const STATUS: Record<CertificateStatus, StatusLook> = {
  valid: { label: "Válido", variant: "success" },
  expired: { label: "Vencido", variant: "warning" },
  revoked: { label: "Revocado", variant: "destructive" },
};

// A status this release doesn't know (a newer server's): never shown as in force.
const UNKNOWN_STATUS: StatusLook = { label: "Desconocido", variant: "secondary" };

/** Whether a certificate is in force: valid, expired (past its validity) or revoked by an admin. */
export function CertificateStatusBadge({ status, className }: { status: CertificateStatus; className?: string }) {
  const { label, variant } = STATUS[status] ?? UNKNOWN_STATUS;
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

/** "Vence el 8 oct 2027", "Venció el…" or "No vence" (for a certificate that isn't revoked). */
export function expiryText({ expires_at, status }: Pick<LearnerCertificate, "expires_at" | "status">) {
  if (!expires_at) return "No vence";
  return `${status === "expired" ? "Venció" : "Vence"} el ${formatDate(expires_at)}`;
}

/** "Emitido el 8 oct 2026 · Vence el 8 oct 2027" (a revoked one, just its issue). */
export function certificateDates(certificate: Pick<LearnerCertificate, "issued_at" | "expires_at" | "status">) {
  const issued = `Emitido el ${formatDate(certificate.issued_at)}`;
  return certificate.status === "revoked" ? issued : `${issued} · ${expiryText(certificate)}`;
}

/** The PDF's link, safe to open, for a valid or expired certificate: none for a revoked one (its PDF is no longer
 * served), nor for a status this release doesn't know. */
export function servedPdfUrl({ status, pdf_url }: Pick<LearnerCertificate, "status" | "pdf_url">) {
  return status === "valid" || status === "expired" ? safeHttpUrl(pdf_url) : undefined;
}
