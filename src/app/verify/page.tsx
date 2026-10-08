"use client";

import { ShieldCheck } from "lucide-react";
import { VerifyForm, VerifyShell } from "@/components/certificates/verify-shell";

/** Without a code: where to type the one printed on a certificate. */
export default function VerifyHomePage() {
  return (
    <VerifyShell>
      <div className="border border-border bg-white p-6 sm:p-10">
        <ShieldCheck className="h-10 w-10 text-accent" aria-hidden />
        <h1 className="display-md mt-6">Verifica un certificado</h1>
        <p className="mt-2 text-muted-foreground">
          Escribe el código que aparece en el certificado para comprobar que es auténtico y si sigue vigente.
        </p>
        <div className="mt-8">
          <VerifyForm />
        </div>
      </div>
    </VerifyShell>
  );
}
