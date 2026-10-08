"use client";

import { useRef } from "react";
import { Ban, Download, ShieldCheck } from "lucide-react";
import { CERTIFICATE_KIND, CertificateStatusBadge, certificateDates, servedPdfUrl } from "@/components/certificates/certificate-badges";
import { RevokeCertificateDialog } from "@/components/certificates/revoke-certificate-dialog";
import { Button } from "@/components/ui/button";
import type { AdminCertificate } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";
import { useOpening } from "@/lib/hooks/use-opening";
import { safeHttpUrl } from "@/lib/safe-url";

/** The id of a certificate's card: the focus lands on it once it is revoked (its "Revocar" goes away). */
const cardId = (id: number) => `person-certificate-${id}`;

function CertificateItem({ certificate, onRevoke }: { certificate: AdminCertificate; onRevoke: () => void }) {
  const pdf = servedPdfUrl(certificate);
  const verify = safeHttpUrl(certificate.verify_url);
  // Every card has the same actions: screen readers hear which certificate each one is for.
  const of = <span className="sr-only"> «{certificate.title}»</span>;
  return (
    <li id={cardId(certificate.id)} tabIndex={-1} className="space-y-2 border border-border bg-white p-4 outline-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-label text-muted-foreground">{CERTIFICATE_KIND[certificate.kind]}</p>
          <p className="mt-1 break-words font-semibold">{certificate.title}</p>
        </div>
        <CertificateStatusBadge status={certificate.status} className="shrink-0" />
      </div>
      <p className="text-xs text-muted-foreground">
        {certificateDates(certificate)}
        {certificate.score !== null && ` · Calificación promedio ${formatPercent(certificate.score)}`}
      </p>
      <p className="break-all text-xs">
        Código <span className="font-semibold">{certificate.code}</span>
      </p>
      {certificate.status === "revoked" && certificate.revoked_reason && (
        <p className="break-words text-xs text-muted-foreground">Motivo: {certificate.revoked_reason}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {pdf && (
          <Button variant="outline" size="sm" asChild>
            <a href={pdf} target="_blank" rel="noopener">
              <Download aria-hidden /> Descargar{of}
            </a>
          </Button>
        )}
        {verify && (
          <Button variant="ghost" size="sm" asChild>
            <a href={verify} target="_blank" rel="noopener">
              <ShieldCheck aria-hidden /> Ver verificación{of}
            </a>
          </Button>
        )}
        {certificate.status !== "revoked" && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onRevoke}>
            <Ban aria-hidden /> Revocar{of}
          </Button>
        )}
      </div>
    </li>
  );
}

/** A person's certificates, newest first (revoked ones too): download, verify and revoke. */
export function PersonCertificates({ certificates }: { certificates: AdminCertificate[] }) {
  const revoking = useOpening<AdminCertificate | null>(null);
  // Revoked, its card loses "Revocar" (the button that opened the dialog): the focus goes back to the card instead.
  const revoked = useRef<number | null>(null);

  if (!certificates.length) return <p className="text-sm text-muted-foreground">Aún no tiene certificados.</p>;
  return (
    <>
      <ul className="space-y-2" aria-label="Certificados">
        {certificates.map((certificate) => (
          <CertificateItem key={certificate.id} certificate={certificate} onRevoke={() => revoking.show(certificate)} />
        ))}
      </ul>
      <RevokeCertificateDialog
        key={revoking.key}
        open={revoking.open}
        certificate={revoking.value}
        onClose={revoking.hide}
        onRevoked={(certificate) => {
          revoked.current = certificate.id;
        }}
        onCloseAutoFocus={(event) => {
          const id = revoked.current;
          revoked.current = null;
          const card = id === null ? null : document.getElementById(cardId(id));
          if (!card) return;
          event.preventDefault();
          card.focus();
        }}
      />
    </>
  );
}
