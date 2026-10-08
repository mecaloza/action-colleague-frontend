import { Pencil } from "lucide-react";
import { DiamondMotif } from "@/components/brand/motif";
import { BackLink } from "@/components/layout/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PersonOverview, UserRow } from "@/lib/api/types";
import { formatDate, formatPercent, formatRelative, initials } from "@/lib/format";
import { Kpi } from "./kpi";

/** The latest sign of life: their last session, or the last thing they did in a course (null: never seen). */
function lastActivity(overview: PersonOverview): string | null {
  const seen = overview.user.last_seen_at;
  const did = overview.recent[0]?.at ?? null;
  if (!seen || !did) return seen ?? did;
  return new Date(seen) > new Date(did) ? seen : did;
}

/** "Asesor de flotas · Ventas" (empty when neither is known). */
const jobOf = (person: Pick<UserRow, "position" | "department">) =>
  [person.position, person.department].filter(Boolean).join(" · ");

function Figures({ overview }: { overview: PersonOverview }) {
  const { kpis } = overview;
  // Every figure has a divider before it; the band hides the one of each row's first (it sits past its left edge).
  const divider = "border-l pl-5";
  return (
    <div className="mt-10 overflow-hidden">
      <dl className="-ml-5 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi value={String(kpis.courses_assigned)} label="Cursos asignados" className={divider} />
        <Kpi value={String(kpis.courses_completed)} label="Cursos completados" className={divider} />
        <Kpi value={formatPercent(kpis.average_score)} label="Puntaje promedio" hint="Sus mejores evaluaciones" className={divider} />
        <Kpi value={String(kpis.points)} label="Puntos" hint="Ganados en total" className={divider} />
        <Kpi value={String(kpis.certificates)} label="Certificados vigentes" className={divider} />
        <Kpi value={String(kpis.activities_played)} label="Actividades jugadas" hint="Hasta el final" className={divider} />
      </dl>
    </div>
  );
}

interface PersonHeaderProps {
  person: UserRow;
  /** Their activity and figures: undefined while it loads, or when it couldn't (the page says why, under the band). */
  overview: PersonOverview | undefined;
  loading: boolean;
  onEdit: () => void;
}

/** The black band of a person's page: who they are, their profile and job, how active they are, and their figures. */
export function PersonHeader({ person, overview, loading, onEdit }: PersonHeaderProps) {
  const job = jobOf(person);
  const last = overview ? lastActivity(overview) : undefined;
  const since = person.created_at ? `En el equipo desde el ${formatDate(person.created_at)}` : "";
  return (
    <section className="band-dark">
      <DiamondMotif className="absolute -right-6 -top-10 hidden h-[220px] w-[150px] opacity-80 md:block lg:right-10" />
      <div className="container relative z-10 py-10">
        <BackLink href="/admin/team">Equipo</BackLink>
        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center bg-accent font-display text-xl font-medium text-white sm:h-16 sm:w-16 sm:text-2xl"
              aria-hidden
            >
              {initials(person.name)}
            </span>
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{person.role === "admin" ? "Administrador" : "Colaborador"}</Badge>
                {person.profile && (
                  <Badge variant="accent" className="max-w-full">
                    <span className="sr-only">Perfil: </span>
                    <span className="truncate">{person.profile.name}</span>
                  </Badge>
                )}
                {person.is_active ? <Badge variant="success">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>}
              </div>
              <h1 className="display-lg break-words text-white">{person.name}</h1>
              <p className="mt-2 break-all text-white/70">{person.email}</p>
              {job && <p className="mt-1 break-words text-sm text-white/60">{job}</p>}
              <p className="mt-1 text-sm text-white/60">
                {last ? (
                  <>
                    Última actividad{" "}
                    <time dateTime={last} title={formatDate(last, true)}>
                      {formatRelative(last)}
                    </time>
                    {since && ` · ${since}`}
                  </>
                ) : last === null ? (
                  `Aún no ha ingresado${since ? ` · ${since}` : ""}`
                ) : (
                  since
                )}
              </p>
            </div>
          </div>
          <Button variant="outline-inverse" className="self-start lg:self-auto" onClick={onEdit}>
            <Pencil /> Editar datos
          </Button>
        </div>
        {overview ? <Figures overview={overview} /> : loading && <Skeleton className="mt-10 h-20 bg-white/10" />}
      </div>
    </section>
  );
}
