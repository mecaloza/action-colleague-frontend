"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, MoreHorizontal, Pencil, Search, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { QueryError } from "@/components/layout/query-state";
import { PersonDialog } from "@/components/team/person-dialog";
import { PersonSheet } from "@/components/team/person-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import type { Role, UserRow } from "@/lib/api/types";
import { type UserListParams, userKeys, usersApi } from "@/lib/api/users";
import { plural } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";

type RoleFilterValue = Role | "all";

const ROLE_FILTERS: { value: RoleFilterValue; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "collaborator", label: "Colaboradores" },
  { value: "admin", label: "Administradores" },
];

const ACTIVE_USERS: UserListParams = { include_inactive: false };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** "12 personas activas · 2 administradores" */
function teamSummary(activeUsers: UserRow[]): string {
  const admins = activeUsers.filter((person) => person.role === "admin").length;
  const people = plural(activeUsers.length, "persona activa", "personas activas");
  return `${people} · ${plural(admins, "administrador", "administradores")}`;
}

function RoleFilter({ value, onChange }: { value: RoleFilterValue; onChange: (value: RoleFilterValue) => void }) {
  return (
    <div role="group" aria-label="Filtrar por rol" className="flex gap-2">
      {ROLE_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value)}
          className={cn(
            "h-9 border px-3.5 text-[12px] font-semibold transition-colors",
            value === filter.value ? "border-ink-800 bg-ink-800 text-white" : "border-input bg-white hover:border-ink-800",
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

interface RowActions {
  onOpen: (person: UserRow) => void;
  onEdit: (person: UserRow) => void;
  onToggleActive: (person: UserRow) => void;
}

function PersonRow({ person, isSelf, onOpen, onEdit, onToggleActive }: RowActions & { person: UserRow; isSelf: boolean }) {
  const ToggleIcon = person.is_active ? UserX : UserCheck;
  return (
    <TableRow className={cn("cursor-pointer", !person.is_active && "opacity-60")} onClick={() => onOpen(person)}>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-ink-800 text-[11px] font-bold text-white">{initials(person.name)}</span>
          <div className="min-w-0">
            <button
              type="button"
              className="block max-w-[220px] truncate text-left font-semibold hover:text-accent"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(person);
              }}
            >
              {person.name}
              {isSelf && <span className="ml-2 text-xs font-normal text-muted-foreground">(tú)</span>}
            </button>
            <p className="max-w-[240px] truncate text-xs text-muted-foreground">{person.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <p className="text-sm">{person.position || "—"}</p>
        <p className="text-xs text-muted-foreground">{person.department}</p>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {person.role === "admin" ? <Badge>Administrador</Badge> : <Badge variant="secondary">Colaborador</Badge>}
        {!person.is_active && (
          <Badge variant="outline" className="ml-2">
            Inactivo
          </Badge>
        )}
      </TableCell>
      <TableCell className="hidden text-sm lg:table-cell">
        {person.enrolled_count ? `${person.completed_count} de ${plural(person.enrolled_count, "curso")}` : "Sin cursos"}
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${person.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onEdit(person)}>
              <Pencil /> Editar datos
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(person)}>
              <KeyRound /> Nueva contraseña
            </DropdownMenuItem>
            {!isSelf && (
              <DropdownMenuItem destructive={person.is_active} onSelect={() => onToggleActive(person)}>
                <ToggleIcon /> {person.is_active ? "Desactivar" : "Reactivar"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

interface PeopleTableProps extends RowActions {
  people: UserRow[];
  selfId: number | undefined;
}

function PeopleTable({ people, selfId, ...actions }: PeopleTableProps) {
  return (
    <div className="border border-border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead className="hidden md:table-cell">Cargo y área</TableHead>
            <TableHead className="hidden sm:table-cell">Rol</TableHead>
            <TableHead className="hidden lg:table-cell">Cursos terminados</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person) => (
            <PersonRow key={person.id} person={person} isSelf={person.id === selfId} {...actions} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilterValue>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [inspected, setInspected] = useState<UserRow | null>(null);
  const searchTerm = useDebouncedValue(search.trim());
  const params: UserListParams = {
    q: searchTerm || undefined,
    role: role === "all" ? undefined : role,
    include_inactive: showInactive,
  };
  const isFiltered = Boolean(searchTerm) || role !== "all";
  const people = useQuery({ queryKey: userKeys.list(params), queryFn: () => usersApi.list(params), placeholderData: keepPreviousData });
  const activeUsers = useQuery({ queryKey: userKeys.list(ACTIVE_USERS), queryFn: () => usersApi.list(ACTIVE_USERS) });

  const toggleActive = useMutation({
    mutationFn: (person: UserRow) => usersApi.update(person.id, { is_active: !person.is_active }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(updated.is_active ? `${updated.name} puede volver a ingresar` : `${updated.name} ya no puede ingresar`);
    },
    onError: toastError,
  });

  /** Reactivating is immediate; deactivating asks first. */
  const confirmToggle = async (person: UserRow) => {
    if (person.is_active) {
      const confirmed = await confirm({
        title: `¿Desactivar a ${person.name}?`,
        description: "No podrá ingresar y se cerrarán sus sesiones. Su avance en los cursos se conserva.",
        confirmLabel: "Desactivar",
        destructive: true,
      });
      if (!confirmed) return;
    }
    toggleActive.mutate(person);
  };

  const addButton = (
    <Button variant="accent" size="lg" onClick={() => setAdding(true)}>
      <UserPlus /> Agregar persona
    </Button>
  );

  return (
    <>
      <PageHero
        eyebrow="Equipo"
        title="Tu equipo"
        description={activeUsers.data ? teamSummary(activeUsers.data) : undefined}
        actions={addButton}
      />

      <section className="container py-10">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <RoleFilter value={role} onChange={setRole} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label="Mostrar inactivos" />
              Mostrar inactivos
            </label>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre, correo o área"
                aria-label="Buscar personas"
                maxLength={200}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {people.isPending ? (
          <Skeleton className="h-72" />
        ) : !people.data ? (
          <QueryError query={people} />
        ) : people.data.length ? (
          <PeopleTable
            people={people.data}
            selfId={user?.id}
            onOpen={setInspected}
            onEdit={setEditing}
            onToggleActive={confirmToggle}
          />
        ) : (
          <EmptyState
            icon={<Users />}
            title={isFiltered ? "Nadie coincide con la búsqueda" : "Aún no hay nadie en el equipo"}
            description={
              isFiltered
                ? "Prueba con otro nombre, correo o filtro."
                : "Agrega a las personas que tomarán los cursos."
            }
            action={isFiltered ? undefined : addButton}
          />
        )}
      </section>

      <PersonDialog
        open={adding || editing !== null}
        onOpenChange={(open) => {
          if (open) return;
          setAdding(false);
          setEditing(null);
        }}
        person={editing}
      />
      <PersonSheet person={inspected} onClose={() => setInspected(null)} />
    </>
  );
}
