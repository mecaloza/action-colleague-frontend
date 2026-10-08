"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Trophy } from "lucide-react";
import { pathName } from "@/components/learn/learner-course-card";
import { type LearnerRankingParams, learnApi, learnKeys } from "@/lib/api/learn";
import type { LearnerPath, LearnerRanking } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** The path whose ranking a learner sees first: the first one still under way, else their first one (none: everyone). */
export function defaultRankingPath(paths: LearnerPath[]): LearnerPath | null {
  return paths.find((path) => path.status !== "completed") ?? paths[0] ?? null;
}

/** "Ruta de flotas", or "Entre todos" for the ranking over every course. */
export const scopeName = (path: Pick<LearnerPath, "title"> | null) => (path ? pathName(path.title) : "Entre todos");

/** Where a learner's ranking lives: `?path=` keeps a path (or "all"), so "Ver ranking" opens the one it talked about. */
const rankingHref = (path: Pick<LearnerPath, "id"> | null) => `/learn/ranking?path=${path ? path.id : "all"}`;

interface TodayRanking {
  path: LearnerPath | null;
  ranking: LearnerRanking;
}

/**
 * Today's ranking around the learner, in the path they are on (or among everyone): null until it loads, and when the
 * parameters hide it. Points change with every play, so it is asked again each time the page shows it.
 */
export function useTodayRanking(paths: LearnerPath[] | undefined): TodayRanking | null {
  const settings = useQuery({ queryKey: learnKeys.settings, queryFn: learnApi.settings });
  const path = paths ? defaultRankingPath(paths) : null;
  const params: LearnerRankingParams = { period: "today", path_id: path?.id };
  // Not before its path is known, nor while hidden: a copy kept from before (another scope, or shown) never shows.
  const shown = paths !== undefined && settings.data?.ranking_visible === true;
  const ranking = useQuery({
    queryKey: learnKeys.ranking(params),
    queryFn: () => learnApi.ranking(params),
    enabled: shown,
    staleTime: 0,
  });
  return shown && ranking.data?.visible ? { path, ranking: ranking.data } : null;
}

/** "Hoy en Ruta de flotas: #3 de 14 · 120 pts", and the way to the whole ranking. On the dark band of "Mis cursos". */
export function RankingCard({ path, ranking, className }: TodayRanking & { className?: string }) {
  const { me, total_people: total } = ranking;
  const where = path ? `Hoy en ${pathName(path.title)}` : "Hoy, entre todos";
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      aria-labelledby="ranking-card"
      className={cn("flex flex-col border border-white/15 bg-white/5 p-6", className)}
    >
      <h2 id="ranking-card" className="eyebrow mb-3 font-sans text-white/60">
        Ranking
      </h2>
      {/* Read as one sentence ("Hoy en Ruta de flotas: #3 de 14 · 120 pts"); the place stands out. */}
      <p className="flex items-start gap-3 text-white">
        <Trophy className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0">
          <span className="block break-words text-sm text-white/70">{where}:</span>{" "}
          {me ? (
            <span className="mt-1 block">
              <span className="font-display text-3xl font-medium tracking-tightest">
                #{me.rank} de {total}
              </span>
              <span className="text-white/70"> · {me.points} pts</span>
            </span>
          ) : (
            <span className="mt-1 block font-display text-2xl font-medium tracking-tightest first-letter:uppercase">
              aún sin puntos
            </span>
          )}
        </span>
      </p>
      {!me && <p className="mt-2 text-sm text-white/70">Juega una actividad o presenta una evaluación para sumar puntos.</p>}
      <Link
        href={rankingHref(path)}
        className="mt-auto inline-flex min-h-10 items-center gap-2 self-start pt-3 text-[11px] font-bold uppercase tracking-label text-accent hover:underline"
      >
        Ver ranking <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </motion.section>
  );
}
