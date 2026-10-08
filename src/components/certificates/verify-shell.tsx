"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The public verification pages (no session): the brand's header, the content and a footer. */
export function VerifyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-mist/60">
      <header className="border-b border-border bg-white">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo />
          <p className="hidden text-[11px] font-bold uppercase tracking-label text-muted-foreground sm:block">
            Verificación de certificados
          </p>
        </div>
      </header>
      <main className="container flex-1 py-8 sm:py-14">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
      <footer className="border-t border-border bg-white">
        <div className="container flex min-h-14 items-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Rubinstein Colleague
        </div>
      </footer>
    </div>
  );
}

const ERROR_ID = "verify-code-error";

/** Type a certificate's code (as printed, in any case) and check it. */
export function VerifyForm({ label = "Código del certificado" }: { label?: string }) {
  const router = useRouter();
  const field = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const typed = code.trim();
        if (typed) {
          router.push(`/verify/${encodeURIComponent(typed.toUpperCase())}`);
          return;
        }
        flushSync(() => setError("Escribe el código que aparece en el certificado."));
        field.current?.focus();
      }}
    >
      <Label htmlFor="verify-code">{label}</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          ref={field}
          id="verify-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
          }}
          placeholder="RC-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ERROR_ID : undefined}
          className="sm:flex-1"
        />
        <Button type="submit">
          <Search /> Verificar
        </Button>
      </div>
      <FieldError id={ERROR_ID} message={error} />
    </form>
  );
}
