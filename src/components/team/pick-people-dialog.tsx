"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  keepKeyboardDown,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRow } from "@/lib/api/types";
import { userKeys, usersApi, type UserListParams } from "@/lib/api/users";
import { plural } from "@/lib/format";
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
            "flex h-5 w-5 shrink-0 items-center justify-center border",
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
            {user.profile ? ` · ${user.profile.name}` : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

interface PickPeopleDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** People who already have it: they are not offered again. */
  excludedIds: Set<number>;
  /** Saves the choice (the active people picked). */
  assign: (userIds: number[]) => Promise<T>;
  /** After saving: what the server returned, and how many were assigned. The dialog then closes. */
  onAssigned: (result: T, count: number) => void;
}

/** Pick active people of the team (search, select all shown) and assign them something: a course, a path. */
export function PickPeopleDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  excludedIds,
  assign,
  onAssigned,
}: PickPeopleDialogProps<T>) {
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
      !excludedIds.has(user.id) &&
      (!term || [user.name, user.email, user.department].some((value) => value.toLowerCase().includes(term))),
  );

  const save = useMutation({
    mutationFn: (userIds: number[]) => assign(userIds),
    onSuccess: (result, userIds) => {
      onAssigned(result, userIds.length);
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
      <DialogContent className="max-w-xl" onOpenAutoFocus={keepKeyboardDown}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo o área"
            aria-label="Buscar personas"
            maxLength={200}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
          <span>{plural(candidates.length, "disponible")}</span>
          {candidates.length > 0 && (
            <button
              type="button"
              className="-my-3 inline-flex min-h-10 items-center font-bold uppercase tracking-label text-accent"
              // Adds the people shown (e.g. a search) to those already chosen.
              onClick={() => setSelected((current) => new Set(Array.from(current).concat(candidates.map((user) => user.id))))}
            >
              Seleccionar todos
            </button>
          )}
        </div>
        {users.error ? (
          <QueryError query={users} />
        ) : (
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
              <li className="p-6 text-center text-sm text-muted-foreground">
                {term ? "Nadie coincide con la búsqueda." : "No hay más personas para asignar."}
              </li>
            )}
          </ul>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate(Array.from(selected))} disabled={selected.size === 0} loading={save.isPending}>
            Asignar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
