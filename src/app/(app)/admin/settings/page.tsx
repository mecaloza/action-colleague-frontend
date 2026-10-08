"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHero } from "@/components/layout/page-hero";
import { QueryError } from "@/components/layout/query-state";
import { SettingsForm } from "@/components/settings/settings-form";
import { Skeleton } from "@/components/ui/skeleton";
import { settingsApi, settingsKeys } from "@/lib/api/settings";

/**
 * "Parámetros": what holds for the whole platform (the company, new evaluations, certificates, the ranking, the review
 * of the videos).
 */
export default function SettingsPage() {
  const settings = useQuery({ queryKey: settingsKeys.all, queryFn: settingsApi.get });
  return (
    <>
      <PageHero
        eyebrow="Administración"
        title="Parámetros"
        description="Lo que vale para toda la plataforma: el nombre de tu empresa, cómo nacen las evaluaciones, cuándo se entregan los certificados, cómo se ganan los puntos del ranking y cómo se revisan los videos."
      />
      <div className="container py-4">
        {settings.isPending ? (
          <div className="space-y-6 py-10">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : !settings.data ? (
          <div className="py-10">
            <QueryError query={settings} />
          </div>
        ) : (
          <SettingsForm settings={settings.data} />
        )}
      </div>
    </>
  );
}
