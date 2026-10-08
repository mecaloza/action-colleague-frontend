"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { StatusBadge } from "@/components/courses/status-badge";
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
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { CourseSummary } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

function CourseOption({ course, order, onToggle }: { course: CourseSummary; order: number; onToggle: () => void }) {
  const selected = order > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-mist",
          selected && "bg-accent-soft",
        )}
      >
        {/* The order it will take: courses are added in the order they are picked. */}
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-bold",
            selected ? "border-accent bg-accent text-white" : "border-input",
          )}
          aria-hidden
        >
          {selected ? order : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words font-semibold">{course.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={course.status} /> {plural(course.module_count, "módulo")}
          </span>
        </span>
        {selected && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
      </button>
    </li>
  );
}

interface AddCoursesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Courses already in the path: not offered again. */
  excludedIds: Set<number>;
  /** How many more the path takes. */
  room: number;
  saving: boolean;
  /** The courses picked, in the order they were picked. */
  onAdd: (courseIds: number[]) => void;
}

/** Pick courses of the library (published or drafts; archived ones can't join a path) to add at the end of the path. */
export function AddCoursesDialog({ open, onOpenChange, excludedIds, room, saving, onAdd }: AddCoursesDialogProps) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  // The library without archived courses (its default view).
  const courses = useQuery({ queryKey: courseKeys.list({}), queryFn: () => coursesApi.list(), enabled: open });

  const term = search.trim().toLowerCase();
  const candidates = (courses.data ?? []).filter(
    (course) =>
      !excludedIds.has(course.id) &&
      (!term || [course.title, course.description].some((value) => value.toLowerCase().includes(term))),
  );
  const tooMany = picked.length > room;

  const toggle = (id: number) =>
    setPicked((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" onOpenAutoFocus={keepKeyboardDown}>
        <DialogHeader>
          <DialogTitle>Agregar cursos</DialogTitle>
          <DialogDescription>
            Se agregan al final, en el orden en que los elijas. Un borrador entra en la ruta cuando lo publiques.
          </DialogDescription>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título"
            aria-label="Buscar cursos"
            maxLength={200}
            className="pl-10"
          />
        </div>
        <p className="pb-2 text-xs text-muted-foreground" aria-live="polite">
          {tooMany
            ? `La ruta admite ${plural(room, "curso")} más: quita ${plural(picked.length - room, "curso")} de tu selección.`
            : picked.length
              ? `${plural(picked.length, "curso elegido", "cursos elegidos")}`
              : plural(candidates.length, "disponible")}
        </p>
        {courses.error ? (
          <QueryError query={courses} />
        ) : (
          <ul className="max-h-80 overflow-y-auto border border-border">
            {courses.isLoading && (
              <li className="p-4">
                <Skeleton className="h-10" />
              </li>
            )}
            {candidates.map((course) => (
              <CourseOption
                key={course.id}
                course={course}
                order={picked.indexOf(course.id) + 1}
                onToggle={() => toggle(course.id)}
              />
            ))}
            {!courses.isLoading && candidates.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                {term ? "Ningún curso coincide con la búsqueda." : "No hay más cursos para agregar."}
              </li>
            )}
          </ul>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => onAdd(picked)} disabled={!picked.length || tooMany} loading={saving}>
            Agregar {picked.length ? `(${picked.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
