"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trophy } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { PageLoading, QueryError } from "@/components/layout/query-state";
import { defaultRankingPath, scopeName } from "@/components/ranking/learner-ranking";
import { isPeriod, PeriodPicker, periodStart, periodWhen } from "@/components/ranking/period-picker";
import { LearnerRankingList, Points } from "@/components/ranking/ranking-list";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { type LearnerRankingParams, learnApi, learnKeys } from "@/lib/api/learn";
import type { LearnerPath, LearnerRanking, RankingPeriod } from "@/lib/api/types";
import { plural } from "@/lib/format";

const HOW_POINTS =
  "Sumas puntos al mejorar tu resultado en las actividades y las evaluaciones, y al completar módulos, cursos y rutas.";

const TITLES: Record<RankingPeriod, string> = {
  today: "Los mejores de hoy",
  week: "Los mejores de la semana",
  month: "Los mejores del mes",
  all: "Los mejores de siempre",
};

/** Where the learner stands, pinned to the bottom of the screen (above the tab bar) while the list scrolls. */
function MyPlace({ ranking }: { ranking: LearnerRanking }) {
  const { me } = ranking;
  return (
    <div className="sticky bottom-[var(--tab-bar,0px)] z-10 mt-4 border border-ink-800 bg-ink-950 px-4 py-3 text-white sm:px-5">
      {me ? (
        <div className="flex items-center justify-between gap-4">
          <p className="min-w-0">
            <span className="eyebrow text-white/60">Tu posición</span>
            <span className="mt-1 block font-display text-2xl font-medium tracking-tightest">
              #{me.rank} <span className="text-base font-normal text-white/70">de {ranking.total_people}</span>
            </span>
          </p>
          <Points value={me.points} inverse />
        </div>
      ) : (
        <p className="text-sm">
          {/* "Aún no sumas puntos hoy", or just "Aún no sumas puntos" (not "… todavía"). */}
          <span className="font-semibold">
            Aún no sumas puntos{ranking.period === "all" ? "" : ` ${periodWhen(ranking.period)}`}.
          </span>{" "}
          <span className="text-white/70">Juega una actividad o presenta una evaluación para entrar al ranking.</span>
        </p>
      )}
    </div>
  );
}

function Unavailable() {
  return (
    <EmptyState
      icon={<Trophy />}
      title="El ranking no está disponible"
      description="Tu empresa decidió no mostrarlo por ahora. Tus puntos y tu avance se siguen guardando."
      action={
        <Button variant="outline" asChild>
          <Link href="/learn">
            <ArrowLeft /> Volver a mis cursos
          </Link>
        </Button>
      }
    />
  );
}

/** The path the address asks for (`?path=`): one of mine by id, "all" for everyone, or else the one to start with. */
function scopeOf(requested: string | null, paths: LearnerPath[]): LearnerPath | null {
  if (requested === "all") return null;
  return paths.find((path) => String(path.id) === requested) ?? defaultRankingPath(paths);
}

function Ranking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: learnKeys.settings, queryFn: learnApi.settings });
  const paths = useQuery({ queryKey: learnKeys.paths, queryFn: learnApi.paths });
  const requestedPeriod = searchParams.get("period");
  const period: RankingPeriod = isPeriod(requestedPeriod) ? requestedPeriod : "today";
  // Undefined until the paths are in: the ranking is asked for once, in the right scope.
  const scope = paths.data ? scopeOf(searchParams.get("path"), paths.data) : undefined;
  const hidden = settings.data?.ranking_visible === false;
  const params: LearnerRankingParams = { period, path_id: scope?.id };
  const ranking = useQuery({
    queryKey: learnKeys.ranking(params),
    queryFn: () => learnApi.ranking(params),
    enabled: scope !== undefined && !hidden,
    placeholderData: keepPreviousData,
    staleTime: 0, // points change with every play
  });
  // Nothing before the scope is known: a copy kept from before (everyone's, say) never shows for a moment.
  const data = scope === undefined ? undefined : ranking.data;
  const unavailable = hidden || data?.visible === false;

  // Hidden since the app last asked: the nav learns it too (its "Ranking" goes away).
  const staleSettings = data?.visible === false && settings.data?.ranking_visible === true;
  useEffect(() => {
    if (staleSettings) void queryClient.invalidateQueries({ queryKey: learnKeys.settings });
  }, [staleSettings, queryClient]);

  // The period and the path live in the address (reloads and shared links keep them). Through `history`: the list
  // changes at once, without asking the server for the page again.
  const show = (next: { period?: RankingPeriod; path?: LearnerPath | null }) => {
    const query = new URLSearchParams();
    const nextPath = next.path === undefined ? scope : next.path;
    query.set("path", nextPath ? String(nextPath.id) : "all");
    const nextPeriod = next.period ?? period;
    if (nextPeriod !== "today") query.set("period", nextPeriod);
    window.history.replaceState(null, "", `${pathname}?${query.toString()}`);
  };

  const myPaths = paths.data ?? [];

  return (
    <>
      {/* On a phone the list comes sooner: how points are earned goes under it there. */}
      <PageHero eyebrow="Ranking" title={TITLES[period]} description={<span className="hidden sm:inline">{HOW_POINTS}</span>} />
      <section className="container py-10">
        {unavailable ? (
          <Unavailable />
        ) : paths.error && !paths.data ? (
          <QueryError query={paths} />
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <PeriodPicker value={period} onChange={(value) => show({ period: value })} />
              {myPaths.length > 0 && (
                <Select
                  value={scope ? String(scope.id) : "all"}
                  onChange={(event) => show({ path: myPaths.find((path) => String(path.id) === event.target.value) ?? null })}
                  aria-label="Ranking de"
                  className="sm:w-72"
                >
                  {myPaths.map((path) => (
                    <option key={path.id} value={path.id}>
                      {path.title}
                    </option>
                  ))}
                  <option value="all">Entre todos</option>
                </Select>
              )}
            </div>

            {!data ? (
              ranking.error ? (
                <QueryError query={ranking} />
              ) : (
                <Skeleton className="h-72" />
              )
            ) : (
              // What it says comes from the ranking shown (the previous one, while another period or path loads).
              <div aria-busy={ranking.isPlaceholderData || undefined}>
                {/* Read out as it changes. It says the period: another one is heard even with as many people. */}
                <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
                  {periodStart(data.period, data.starts_at)} · {scopeName(data.path)} ·{" "}
                  {plural(data.total_people, "persona con puntos", "personas con puntos")}
                </p>
                {data.items.length ? (
                  <LearnerRankingList items={data.items} label={`${TITLES[data.period]}: ${scopeName(data.path)}`} />
                ) : (
                  <EmptyState
                    icon={<Trophy />}
                    title={`Nadie suma puntos ${periodWhen(data.period)}`}
                    description="Sé la primera persona: juega una actividad o presenta una evaluación."
                  />
                )}
                <MyPlace ranking={data} />
              </div>
            )}
            <p className="mt-6 text-sm text-muted-foreground sm:hidden">{HOW_POINTS}</p>
          </>
        )}
      </section>
    </>
  );
}

export default function LearnerRankingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Ranking />
    </Suspense>
  );
}
