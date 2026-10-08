"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Trophy } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { QueryError } from "@/components/layout/query-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { pathKeys, pathsApi } from "@/lib/api/paths";
import { type RankingParams, rankingApi, rankingKeys } from "@/lib/api/ranking";
import { plural } from "@/lib/format";
import { RankingList } from "./ranking-list";

const ALL_PATHS = {};
/** The panel lists the first few; each path's tab has them all. */
const SHOWN = 5;

/** The panel's "Los mejores hoy": who earned the most points today, over every course or in one path. */
export function TopTodayCard({ refetchInterval }: { refetchInterval?: number }) {
  const [pathId, setPathId] = useState<number | null>(null);
  const paths = useQuery({ queryKey: pathKeys.list(ALL_PATHS), queryFn: () => pathsApi.list(ALL_PATHS) });
  const params: RankingParams = { period: "today", path_id: pathId ?? undefined, limit: SHOWN };
  const ranking = useQuery({
    queryKey: rankingKeys.list(params),
    queryFn: () => rankingApi.get(params),
    placeholderData: keepPreviousData,
    refetchInterval,
  });
  const data = ranking.data;
  // Of the ranking shown (the previous one, while another path loads).
  const pathTitle = data?.path?.title;

  return (
    <section aria-labelledby="top-today">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 id="top-today" className="display-md">
          Los mejores hoy
        </h2>
        {Boolean(paths.data?.length) && (
          <Select
            value={pathId ?? ""}
            onChange={(event) => setPathId(event.target.value ? Number(event.target.value) : null)}
            aria-label="Ranking de"
            className="sm:w-60"
          >
            <option value="">Todos los cursos</option>
            {paths.data?.map((path) => (
              <option key={path.id} value={path.id}>
                {path.title}
              </option>
            ))}
          </Select>
        )}
      </div>
      {ranking.isPending ? (
        <Skeleton className="h-48" />
      ) : !data ? (
        <QueryError query={ranking} />
      ) : (
        <div aria-busy={ranking.isPlaceholderData || undefined}>
          {data.items.length ? (
            <RankingList items={data.items} label={pathTitle ? `Los mejores hoy en ${pathTitle}` : "Los mejores hoy"} compact />
          ) : (
            <EmptyState
              icon={<Trophy />}
              title="Nadie suma puntos hoy"
              description={
                pathTitle
                  ? `Las personas de «${pathTitle}» suman puntos al jugar actividades, presentar evaluaciones y completar cursos.`
                  : "Tu equipo suma puntos al jugar actividades, presentar evaluaciones y completar cursos."
              }
              className="py-10"
            />
          )}
          {(data.items.length > 0 || pathId !== null) && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              {data.items.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {plural(data.total_people, "persona sumó", "personas sumaron")} puntos hoy
                </p>
              )}
              {/* Its other periods (this week, this month, ever) are on the path's own tab. */}
              {pathId !== null && (
                <Link
                  href={`/admin/paths/${pathId}?tab=ranking`}
                  className="-my-2 ml-auto inline-flex min-h-10 items-center gap-1.5 text-[11px] font-bold uppercase tracking-label text-accent-strong hover:underline"
                >
                  Ver el ranking de la ruta <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
