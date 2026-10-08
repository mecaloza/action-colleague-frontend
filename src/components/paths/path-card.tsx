import Link from "next/link";
import { Layers, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { PathRow } from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";
import { PathStatusBadge } from "./path-badges";

/** A path in the list: its status, courses, profiles and how many of its people completed it. */
export function PathCard({ path }: { path: PathRow }) {
  return (
    <Link
      href={`/admin/paths/${path.id}`}
      className="group flex flex-col border border-border bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ink-800 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PathStatusBadge status={path.status} />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5" aria-hidden /> {plural(path.course_count, "curso")}
        </span>
      </div>
      <h3 className="mt-4 break-words font-display text-xl font-semibold leading-tight tracking-tightest group-hover:text-accent">
        {path.title}
      </h3>
      {path.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{path.description}</p>}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {path.profiles.length ? (
          path.profiles.map((profile) => (
            <Badge key={profile.id} variant="outline" className="max-w-full">
              <span className="truncate">{profile.name}</span>
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Sin perfiles: solo personas asignadas a mano</span>
        )}
      </div>
      <div className="min-h-4 flex-1" aria-hidden />
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <Progress value={path.completion_rate} className="flex-1" aria-label="Personas que la completaron" />
          <span className="w-10 text-right text-xs font-semibold">{formatPercent(path.completion_rate)}</span>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {path.people_count
            ? `Completada por ${path.completed_count} de ${plural(path.people_count, "persona")}`
            : "Nadie la tiene todavía"}
        </p>
      </div>
    </Link>
  );
}

/** Placeholder with the proportions of PathCard, shown while the list loads. */
export function PathCardSkeleton() {
  return (
    <div className="space-y-4 border border-border p-5">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
