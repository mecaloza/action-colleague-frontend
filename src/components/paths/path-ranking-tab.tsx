"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { QueryError } from "@/components/layout/query-state";
import { SectionHeader } from "@/components/layout/section-header";
import { PeriodPicker, periodStart, periodWhen } from "@/components/ranking/period-picker";
import { RankingList } from "@/components/ranking/ranking-list";
import { Skeleton } from "@/components/ui/skeleton";
import { type RankingParams, rankingApi, rankingKeys } from "@/lib/api/ranking";
import type { PathDetail, RankingPeriod } from "@/lib/api/types";
import { plural } from "@/lib/format";

/** How many the tab lists (the API takes up to 100). */
const SHOWN = 50;

/** Who earned the most points in the path's courses (and for completing it), today, this week, this month or ever. */
export function PathRankingTab({ path }: { path: PathDetail }) {
  const [period, setPeriod] = useState<RankingPeriod>("today");
  const params: RankingParams = { period, path_id: path.id, limit: SHOWN };
  const ranking = useQuery({
    queryKey: rankingKeys.list(params),
    queryFn: () => rankingApi.get(params),
    placeholderData: keepPreviousData,
  });
  const data = ranking.data;

  return (
    <div>
      <SectionHeader
        title="Ranking"
        description="Quién sumó más puntos en los cursos de esta ruta. Se ganan al mejorar en actividades y evaluaciones, y al completar módulos, cursos y la ruta."
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodPicker value={period} onChange={setPeriod} />
        {data && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {periodStart(data.period, data.starts_at)} · {plural(data.total_people, "persona con puntos", "personas con puntos")}
          </p>
        )}
      </div>

      {ranking.isPending ? (
        <Skeleton className="h-48" />
      ) : !data ? (
        <QueryError query={ranking} />
      ) : data.items.length ? (
        <div aria-busy={ranking.isPlaceholderData || undefined}>
          <RankingList items={data.items} label={`Ranking de ${path.title}`} />
          {data.total_people > data.items.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              Se muestran los {data.items.length} primeros de {data.total_people}.
            </p>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Trophy />}
          title={`Nadie suma puntos ${periodWhen(data.period)}`}
          description={
            path.status === "published"
              ? "Las personas de la ruta suman puntos al jugar las actividades y presentar las evaluaciones de sus cursos."
              : "Cuando publiques la ruta, sus personas sumarán puntos en sus cursos."
          }
        />
      )}
    </div>
  );
}
