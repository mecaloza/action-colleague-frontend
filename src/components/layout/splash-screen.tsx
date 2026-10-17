"use client";

import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

/**
 * Full-screen placeholder shown while the session resolves or a redirect is in flight.
 * If the server can't be reached to confirm the session, offers to retry or sign out.
 */
export function SplashScreen() {
  const { status, retry, logout } = useAuth();

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-950 px-6 text-center text-white">
        <span className="h-6 w-6 rotate-45 bg-accent" aria-hidden />
        <div role="alert" className="max-w-sm space-y-2">
          <p className="font-display text-2xl font-medium tracking-tightest">No pudimos conectar con el servidor</p>
          <p className="text-sm text-white/60">Revisa tu conexión. Tu sesión sigue guardada.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="inverse" onClick={retry}>
            Reintentar
          </Button>
          <Button variant="outline-inverse" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-ink-950">
      <span className="h-8 w-8 rotate-45 bg-accent motion-safe:animate-pulse" aria-hidden />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
