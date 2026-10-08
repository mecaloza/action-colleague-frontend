import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { CertificateKind, CertificateStatus, LearnerCertificate } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { safeHttpUrl } from "@/lib/safe-url";

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

/** The PDF's link, safe to open; none for a revoked certificate (its PDF is no longer served). */
export function servedPdfUrl({ status, pdf_url }: Pick<LearnerCertificate, "status" | "pdf_url">) {
  return status === "revoked" ? undefined : safeHttpUrl(pdf_url);
}
