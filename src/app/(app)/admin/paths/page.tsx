"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, Route } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { QueryError } from "@/components/layout/query-state";
import { ScrollRow } from "@/components/layout/scroll-row";
import { NewPathDialog } from "@/components/paths/new-path-dialog";
import { PathCard, PathCardSkeleton } from "@/components/paths/path-card";
import { Button } from "@/components/ui/button";
import { pathKeys, pathsApi } from "@/lib/api/paths";
import type { PathStatus } from "@/lib/api/types";
import { useOpening } from "@/lib/hooks/use-opening";
import { cn } from "@/lib/utils";

type StatusFilterValue = PathStatus | "all";

const FILTERS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "Activas" }, // published and drafts; archived ones have their own filter
  { value: "published", label: "Publicadas" },
  { value: "draft", label: "Borradores" },
  { value: "archived", label: "Archivadas" },
];

const PATH_GRID = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

function StatusFilter({ value, onChange }: { value: StatusFilterValue; onChange: (value: StatusFilterValue) => void }) {
  return (
    <ScrollRow role="group" aria-label="Filtrar rutas" className="gap-6 border-b border-border">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value)}
          className={cn(
            "-mb-px min-h-11 whitespace-nowrap border-b-2 text-[11.5px] font-bold uppercase tracking-label transition-colors",
            value === filter.value ? "border-accent text-ink-800" : "border-transparent text-muted-foreground hover:text-ink-800",
          )}
        >
          {filter.label}
        </button>
      ))}
    </ScrollRow>
  );
}

export default function PathsPage() {
  const [filter, setFilter] = useState<StatusFilterValue>("all");
  const creating = useOpening(null);
  const params = { status: filter === "all" ? undefined : filter };
  const paths = useQuery({
    queryKey: pathKeys.list(params),
    queryFn: () => pathsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const newButton = (size?: "lg") => (
    <Button variant="accent" size={size} onClick={() => creating.show(null)}>
      <Plus /> Nueva ruta
    </Button>
  );

  return (
    <>
      <PageHero
        eyebrow="Rutas"
        title="Rutas de aprendizaje"
        description="Ordena varios cursos en un recorrido y asígnalo por perfil: cada persona avanza curso por curso, y ves quién va al día y quién terminó."
        actions={newButton("lg")}
      />

      <section className="container py-10">
        <div className="mb-8">
          <StatusFilter value={filter} onChange={setFilter} />
        </div>

        {paths.isLoading ? (
          <div className={PATH_GRID}>
            {Array.from({ length: 3 }).map((_, index) => (
              <PathCardSkeleton key={index} />
            ))}
          </div>
        ) : paths.error && !paths.data ? (
          <QueryError query={paths} />
        ) : paths.data?.length ? (
          <div className={PATH_GRID}>
            {paths.data.map((path) => (
              <PathCard key={path.id} path={path} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Route />}
            title={filter === "all" ? "Todavía no hay rutas" : "No hay rutas con este estado"}
            description={
              filter === "all"
                ? "Una ruta reúne varios cursos en orden, por ejemplo todo lo que un asesor nuevo necesita en su primer mes."
                : "Prueba con otro filtro."
            }
            action={filter === "all" ? newButton() : undefined}
          />
        )}
      </section>

      <NewPathDialog key={creating.key} open={creating.open} onClose={creating.hide} />
    </>
  );
}
