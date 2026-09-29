"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Keeps the app shell (navigation) alive when a page crashes, and offers a way out. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container flex min-h-[60vh] flex-col items-start justify-center gap-6 py-16">
      <p className="eyebrow">Algo salió mal</p>
      <h1 className="display-md max-w-2xl">No pudimos mostrar esta página.</h1>
      <p className="max-w-xl text-muted-foreground">
        Puede ser un problema temporal. Intenta de nuevo; si continúa, vuelve al inicio.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>
          <RotateCcw /> Reintentar
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
