"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, Download, ShieldCheck } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { learnApi, learnKeys } from "@/lib/api/learn";
import type { LearnerCertificate } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";
import { safeHttpUrl } from "@/lib/safe-url";
import { CERTIFICATE_KIND, CertificateStatusBadge, certificateDates, servedPdfUrl } from "./certificate-badges";

function CertificateCard({ certificate }: { certificate: LearnerCertificate }) {
  const pdf = servedPdfUrl(certificate);
  const verify = safeHttpUrl(certificate.verify_url);
  // Every card has the same two links: screen readers hear which certificate each one is for.
  const of = <span className="sr-only"> «{certificate.title}»</span>;
  return (
    <li className="flex flex-col border border-border bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-label text-muted-foreground">{CERTIFICATE_KIND[certificate.kind]}</p>
          <h3 className="mt-1 break-words font-display text-lg font-semibold leading-tight tracking-tightest">{certificate.title}</h3>
        </div>
        <CertificateStatusBadge status={certificate.status} className="shrink-0" />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {certificateDates(certificate)}
        {certificate.score !== null && ` · Calificación promedio ${formatPercent(certificate.score)}`}
      </p>
      <p className="mt-1 break-all text-sm">
        Código <span className="font-semibold">{certificate.code}</span>
      </p>
      {certificate.status === "revoked" && (
        <p className="mt-2 text-sm text-muted-foreground">Ya no es válido. Si crees que es un error, habla con tu administrador.</p>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {pdf && (
          <Button variant="outline" size="sm" asChild>
            <a href={pdf} target="_blank" rel="noopener">
              <Download aria-hidden /> Descargar certificado{of}
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
      </div>
    </li>
  );
}

/** "Mis certificados": every certificate the signed-in person earned, newest first, whatever its status. */
export function MyCertificates() {
  const certificates = useQuery({ queryKey: learnKeys.certificates, queryFn: learnApi.certificates });
  if (certificates.isPending) return <Skeleton className="h-36" />;
  if (!certificates.data) return <QueryError query={certificates} />;
  if (!certificates.data.length) {
    return (
      <p className="flex items-start gap-3 border border-dashed border-input bg-mist/50 px-4 py-4 text-sm text-muted-foreground">
        <Award className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        Aún no tienes certificados. Los recibes al completar un curso o una ruta de aprendizaje.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 xl:grid-cols-2" aria-label="Mis certificados">
      {certificates.data.map((certificate) => (
        <CertificateCard key={certificate.id} certificate={certificate} />
      ))}
    </ul>
  );
}
