"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { coursesApi } from "@/lib/api/courses";
import type { CourseDetail, UserRow } from "@/lib/api/types";
import { userKeys, usersApi, type UserListParams } from "@/lib/api/users";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const ACTIVE_USERS: UserListParams = { include_inactive: false };

function CandidateRow({ user, isSelected, onToggle }: { user: UserRow; isSelected: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-mist",
          isSelected && "bg-accent-soft",
        )}
        aria-pressed={isSelected}
      >
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center border",
            isSelected ? "border-accent bg-accent text-white" : "border-input",
          )}
        >
          {isSelected && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.email}
            {user.department ? ` · ${user.department}` : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

interface AssignDialogProps {
  course: CourseDetail;
  /** People already in the course: they are not offered again. */
  enrolledIds: Set<number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignDialog({ course, enrolledIds, open, onOpenChange }: AssignDialogProps) {
  const { storeParticipants } = useCourseCache();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const users = useQuery({
    queryKey: userKeys.list(ACTIVE_USERS),
    queryFn: () => usersApi.list(ACTIVE_USERS),
    enabled: open,
  });

  const term = search.trim().toLowerCase();
  const candidates = (users.data ?? []).filter(
    (user) =>
      !enrolledIds.has(user.id) &&
      (!term || [user.name, user.email, user.department].some((value) => value.toLowerCase().includes(term))),
  );

  const assign = useMutation({
    mutationFn: () => coursesApi.addParticipants(course.id, Array.from(selected)),
    onSuccess: (participants) => {
      storeParticipants(course.id, participants);
      toast.success(selected.size === 1 ? "Persona asignada" : `${selected.size} personas asignadas`);
      setSelected(new Set());
      onOpenChange(false);
    },
    onError: toastError,
  });

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Asignar personas</DialogTitle>
          <DialogDescription>
            Verán el curso en «Mis cursos» {course.status === "published" ? "de inmediato" : "cuando lo publiques"}.
          </DialogDescription>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo o área"
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
          <span>{candidates.length} disponibles</span>
          {candidates.length > 0 && (
            <button
              className="font-bold uppercase tracking-label text-accent"
              onClick={() => setSelected(new Set(candidates.map((user) => user.id)))}
            >
              Seleccionar todos
            </button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto border border-border">
          {users.isLoading && (
            <li className="p-4">
              <Skeleton className="h-10" />
            </li>
          )}
          {candidates.map((user) => (
            <CandidateRow key={user.id} user={user} isSelected={selected.has(user.id)} onToggle={() => toggle(user.id)} />
          ))}
          {!users.isLoading && candidates.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No hay más personas para asignar.</li>
          )}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => assign.mutate()} disabled={selected.size === 0} loading={assign.isPending}>
            Asignar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
