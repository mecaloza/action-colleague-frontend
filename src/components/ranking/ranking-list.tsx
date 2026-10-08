import Link from "next/link";
import type { LearnerRankingItem, RankingItem } from "@/lib/api/types";
import { initials as initialsOf, plural, twoDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "120 pts" on screen, "120 puntos" read out. `inverse` over a dark background. */
export function Points({ value, inverse = false }: { value: number; inverse?: boolean }) {
  return (
    <span className="shrink-0 whitespace-nowrap text-right">
      <span aria-hidden>
        <span className="font-display text-xl font-medium tracking-tightest">{value}</span>{" "}
        <span className={cn("text-xs", inverse ? "text-white/70" : "text-muted-foreground")}>pts</span>
      </span>
      <span className="sr-only">{plural(value, "punto")}</span>
    </span>
  );
}

/** The place, as the brand numbers things ("01"); read out as "Puesto 1". Ties share it. */
function Place({ rank }: { rank: number }) {
  return (
    <span className="w-9 shrink-0 font-display text-2xl font-medium text-accent">
      <span aria-hidden>{twoDigits(rank)}</span>
      <span className="sr-only">Puesto {rank}: </span>
    </span>
  );
}

interface RankingListProps {
  items: RankingItem[];
  label: string;
  /** The panel's card: name and points only. */
  compact?: boolean;
}

/** The admin's ranking: each person's place, name (to their page), profile, points and courses completed. */
export function RankingList({ items, label, compact = false }: RankingListProps) {
  return (
    <ol className="divide-y divide-border border border-border bg-white" aria-label={label}>
      {items.map((item) => (
        <li key={item.user.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
          <Place rank={item.rank} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin/team/${item.user.id}`}
              className="-my-2.5 block max-w-full truncate py-2.5 font-semibold hover:text-accent"
            >
              {item.user.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {item.user.profile?.name ?? "Sin perfil"}
              {!compact && ` · ${plural(item.completed_courses, "curso completado", "cursos completados")}`}
            </p>
          </div>
          <Points value={item.points} />
        </li>
      ))}
    </ol>
  );
}

/** A learner's ranking: the top places with initials and points, their own row marked "Tú". */
export function LearnerRankingList({ items, label }: { items: LearnerRankingItem[]; label: string }) {
  return (
    <ol className="divide-y divide-border border border-border bg-white" aria-label={label}>
      {items.map((item, index) => (
        // Anonymous rows (no ids): the order the server gave is the key.
        <li key={index} className={cn("flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5", item.is_me && "bg-accent-soft")}>
          <Place rank={item.rank} />
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center text-[12px] font-bold text-white",
              item.is_me ? "bg-accent" : "bg-ink-800",
            )}
            aria-hidden
          >
            {item.initials || initialsOf(item.name)}
          </span>
          {/* A long name wraps (on a phone, too): truncated, the learner might not recognize theirs. */}
          <p className="min-w-0 flex-1 break-words font-semibold">
            {item.name}
            {item.is_me && (
              <span className="ml-2 inline-block bg-accent px-1.5 py-0.5 align-middle text-[10.5px] font-bold uppercase leading-none tracking-[0.1em] text-white">
                Tú
              </span>
            )}
          </p>
          <Points value={item.points} />
        </li>
      ))}
    </ol>
  );
}
