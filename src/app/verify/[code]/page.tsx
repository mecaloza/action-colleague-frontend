"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { NotFoundBanner, PublicCertificateView, verdictText } from "@/components/certificates/public-certificate";
import { VerifyForm, VerifyShell } from "@/components/certificates/verify-shell";
import { QueryError } from "@/components/layout/query-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api/client";
import { certificateKeys, certificatesApi } from "@/lib/api/certificates";

/** The code as it came in the address (the server reads it in any case, with or without dashes). */
function codeIn(raw: string | undefined): string {
  try {
    return decodeURIComponent(raw ?? "").trim();
  } catch {
    return raw ?? "";
  }
}

/** A certificate's public verification: whether it is genuine and in force, and what it certifies. */
export default function VerifyCertificatePage() {
  const code = codeIn(useParams<{ code: string }>().code);
  // No session is needed, but the app checks the one there may be first: without one it empties the query cache,
  // which would drop a verification already on its way.
  const { status } = useAuth();
  const certificate = useQuery({
    queryKey: certificateKeys.public(code),
    queryFn: () => certificatesApi.verify(code),
    enabled: Boolean(code) && status !== "loading",
  });
  const notFound = !code || (certificate.error instanceof ApiError && certificate.error.status === 404);
  const data = certificate.data;

  // Read out once the answer arrives (the page first says it is checking).
  const announcement = data
    ? `${verdictText(data)} ${data.recipient_name}, ${data.title}.`
    : notFound
      ? "Certificado no encontrado."
      : "Verificando el certificado…";

  return (
    <VerifyShell>
      <p className="sr-only" role="status">
        {announcement}
      </p>
      {data ? (
        <>
          <PublicCertificateView certificate={data} />
          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿Tienes otro certificado?{" "}
            <Link href="/verify" className="inline-flex min-h-10 items-center font-semibold text-accent-strong underline underline-offset-4">
              Verificar otro código
            </Link>
          </p>
        </>
      ) : notFound ? (
        <>
          <NotFoundBanner code={code} />
          <div className="mt-6 border border-border bg-white p-6 sm:p-8">
            <VerifyForm label="Prueba con otro código" />
          </div>
        </>
      ) : certificate.error ? (
        <QueryError query={certificate} />
      ) : (
        <div className="space-y-6" aria-hidden>
          <Skeleton className="h-28" />
          <Skeleton className="h-96" />
        </div>
      )}
    </VerifyShell>
  );
}
