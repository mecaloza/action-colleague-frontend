"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, UserMinus, UserPlus, Users } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { QueryError } from "@/components/layout/query-state";
import { SectionHeader } from "@/components/layout/section-header";
import { PickPeopleDialog } from "@/components/team/pick-people-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pathKeys, pathsApi } from "@/lib/api/paths";
import type { PathDetail, PathPerson } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";
import { useOpening } from "@/lib/hooks/use-opening";
import { usePathCache } from "@/lib/hooks/use-path-cache";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { JourneyBadge, SourceBadge, StepChips, StepLegend, deadlineText } from "./path-badges";

/** The path comes with their profile: taking it away by hand would not last (the server answers the same). */
function profileReason(person: PathPerson): string {
  const profile = person.user.profile ? ` «${person.user.profile.name}»` : "";
  return `Esta persona tiene la ruta por su perfil${profile}. Cambia su perfil para quitarla.`;
}

interface PersonViewProps {
  person: PathPerson;
  titles: Map<number, string>;
  onRemove: () => void;
}

/** What assigning the path does right away. */
function assignedNote(path: PathDetail): string {
  if (path.status !== "published") return "La verán cuando publiques la ruta.";
  const courses = path.courses.length;
  if (!courses) return "La verán en «Mis cursos» de inmediato.";
  return `La verán en «Mis cursos» de inmediato y quedarán inscritas en ${courses === 1 ? "su curso" : `sus ${courses} cursos`}.`;
}

/** "Vence el…" in red once it is past. */
function Deadline({ person }: { person: PathPerson }) {
  return (
    <span className={cn("text-xs", person.status === "overdue" ? "font-semibold text-destructive" : "text-muted-foreground")}>
      {deadlineText(person)}
    </span>
  );
}

/**
 * "Quitar": only someone whose profile doesn't give them the path can lose it by hand. For the others it stays
 * tappable (dimmed) and says why, as a locked module does.
 */
function RemoveButton({ person, onRemove, compact }: Omit<PersonViewProps, "titles"> & { compact?: boolean }) {
  const label = `Quitar la ruta a ${person.user.name}`;
  const onClick = () => (person.removable ? onRemove() : toast(profileReason(person), { id: `path-person-${person.user.id}` }));
  return compact ? (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-disabled={!person.removable || undefined}
      className={cn(!person.removable && "opacity-45")}
      onClick={onClick}
    >
      <UserMinus />
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-mr-2 ml-auto", !person.removable && "opacity-45")}
      aria-label={label}
      aria-disabled={!person.removable || undefined}
      onClick={onClick}
    >
      <UserMinus /> Quitar
    </Button>
  );
}

function PersonProgress({ person }: { person: PathPerson }) {
  return (
    <div className="flex items-center gap-3">
      <Progress value={person.progress_pct} className="flex-1" aria-label={`Avance de ${person.user.name}`} />
      <span className="w-10 text-right text-xs font-semibold">{formatPercent(person.progress_pct)}</span>
    </div>
  );
}

/** On a phone each person is a card (a table there would hide "Quitar" past the edge). */
function PersonCard({ person, titles, onRemove }: PersonViewProps) {
  const { user } = person;
  return (
    <li className="space-y-3 border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.position || user.email}</p>
        </div>
        <JourneyBadge status={person.status} />
      </div>
      <PersonProgress person={person} />
      <StepChips steps={person.steps} titles={titles} name={user.name} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <SourceBadge source={person.source} />
          <Deadline person={person} />
        </span>
        <RemoveButton person={person} onRemove={onRemove} />
      </div>
    </li>
  );
}

function PersonRow({ person, titles, onRemove }: PersonViewProps) {
  const { user } = person;
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.position || user.email}</p>
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1.5">
          <JourneyBadge status={person.status} />
          <Deadline person={person} />
        </div>
      </TableCell>
      <TableCell>
        <div className="min-w-[160px] space-y-2">
          <PersonProgress person={person} />
          <StepChips steps={person.steps} titles={titles} name={user.name} />
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <SourceBadge source={person.source} />
      </TableCell>
      <TableCell>
        <RemoveButton person={person} onRemove={onRemove} compact />
      </TableCell>
    </TableRow>
  );
}

/** The path's notice: who sees it while it is not published. */
function VisibilityNotice({ path }: { path: PathDetail }) {
  if (path.status === "published") return null;
  return (
    <Alert variant="info" role="note" className="mb-6">
      <Info />
      <AlertDescription>
        {path.status === "draft"
          ? "La ruta es un borrador: sus personas la verán, y quedarán inscritas en sus cursos, cuando la publiques."
          : "La ruta está archivada: sus personas no la ven. Se conserva quién la tiene y su avance."}
      </AlertDescription>
    </Alert>
  );
}

/** Who takes the path and how each one goes, course by course: assign by hand and take it away. */
export function PathPeopleTab({ path }: { path: PathDetail }) {
  const confirm = useConfirm();
  const { refreshPaths } = usePathCache();
  const assigning = useOpening(null);
  const people = useQuery({ queryKey: pathKeys.people(path.id), queryFn: () => pathsApi.people(path.id) });
  const titles = new Map(path.courses.map((course) => [course.course_id, course.title]));

  const remove = useMutation({
    mutationFn: (person: PathPerson) => pathsApi.removePerson(path.id, person.user.id),
    onSuccess: (_, person) => toast.success(`Le quitaste la ruta a ${person.user.name}`),
    onError: toastError,
    // Also after a refusal: their profile may give them the path now.
    onSettled: () => void refreshPaths(),
  });

  const askRemove = async (person: PathPerson) => {
    const confirmed = await confirm({
      title: `¿Quitarle la ruta a ${person.user.name}?`,
      description: "Deja de verla. Conserva sus cursos y su avance.",
      confirmLabel: "Quitar ruta",
      destructive: true,
    });
    if (confirmed) remove.mutate(person);
  };

  const assignButton = (
    <Button onClick={() => assigning.show(null)}>
      <UserPlus /> Asignar personas
    </Button>
  );
  const list = people.data ?? [];

  return (
    <div>
      <SectionHeader
        title="Personas"
        description="Quiénes tienen la ruta y cómo van en cada curso. Las personas de sus perfiles la reciben al publicarla."
        action={assignButton}
      />
      <VisibilityNotice path={path} />

      {people.isPending ? (
        <Skeleton className="h-48" />
      ) : people.error && !people.data ? (
        <QueryError query={people} />
      ) : list.length ? (
        <div className="space-y-4">
          <StepLegend />
          <ul className="space-y-2 sm:hidden" aria-label="Personas de la ruta">
            {list.map((person) => (
              <PersonCard key={person.user.id} person={person} titles={titles} onRemove={() => void askRemove(person)} />
            ))}
          </ul>
          <div className="hidden border border-border bg-white sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>Estado y plazo</TableHead>
                  <TableHead>Avance por curso</TableHead>
                  <TableHead className="hidden md:table-cell">Origen</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((person) => (
                  <PersonRow key={person.user.id} person={person} titles={titles} onRemove={() => void askRemove(person)} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Users />}
          title="Nadie tiene esta ruta todavía"
          description={
            path.profiles.length
              ? "Las personas de sus perfiles la reciben al publicarla. También puedes asignarla a mano."
              : "Vincula perfiles en Ajustes para que sus personas la reciban, o asígnala a mano."
          }
          action={assignButton}
        />
      )}

      <PickPeopleDialog
        key={assigning.key}
        open={assigning.open}
        onOpenChange={(open) => !open && assigning.hide()}
        title="Asignar personas"
        description={assignedNote(path)}
        excludedIds={new Set(list.map((person) => person.user.id))}
        assign={(userIds) => pathsApi.addPeople(path.id, userIds)}
        onAssigned={(_, count) => {
          void refreshPaths();
          toast.success(count === 1 ? "Persona asignada a la ruta" : `${count} personas asignadas a la ruta`);
        }}
      />
    </div>
  );
}
