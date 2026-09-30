"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { EnrollmentBadge } from "@/components/courses/status-badge";
import { QueryError } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRow } from "@/lib/api/types";
import { userKeys, usersApi } from "@/lib/api/users";
import { formatDate, formatPercent, plural } from "@/lib/format";

function PersonCourses({ person }: { person: UserRow }) {
  const courses = useQuery({ queryKey: userKeys.courses(person.id), queryFn: () => usersApi.courses(person.id) });
  if (courses.isPending) return <Skeleton className="h-40" />;
  if (!courses.data) return <QueryError query={courses} />;
  if (!courses.data.length) {
    return <p className="text-sm text-muted-foreground">No tiene cursos asignados. Asígnalos desde cada curso, en Participantes.</p>;
  }
  return (
    <ul className="space-y-3">
      {courses.data.map((course) => (
        <li key={course.course_id} className="border border-border p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <Link href={`/admin/courses/${course.course_id}`} className="font-semibold hover:text-accent">
              {course.title}
            </Link>
            <EnrollmentBadge status={course.status} />
          </div>
          <div className="flex items-center gap-3">
            <Progress value={course.progress_pct} className="flex-1" />
            <span className="w-10 text-right text-xs font-semibold">{formatPercent(course.progress_pct)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {course.completed_modules} de {plural(course.total_modules, "módulo")}
            {course.completed_at ? ` · terminado el ${formatDate(course.completed_at)}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-bold uppercase tracking-label text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function PersonDetail({ person }: { person: UserRow }) {
  return (
    <>
      <SheetHeader>
        <p className="eyebrow mb-2">{person.role === "admin" ? "Administrador" : "Colaborador"}</p>
        <SheetTitle className="font-display text-2xl font-medium tracking-tightest">{person.name}</SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">{person.email}</SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-8">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Detail label="Cargo">{person.position || "—"}</Detail>
          <Detail label="Área">{person.department || "—"}</Detail>
          <Detail label="Desde">{formatDate(person.created_at)}</Detail>
          <Detail label="Estado">
            {person.is_active ? <Badge variant="success">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
          </Detail>
        </dl>
        <section>
          <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-medium tracking-tightest">
            <BookOpen className="h-5 w-5 text-accent" /> Cursos
          </h3>
          <PersonCourses person={person} />
        </section>
      </SheetBody>
    </>
  );
}

interface PersonSheetProps {
  open: boolean;
  /** The last person shown: kept after closing, so the panel doesn't empty while it slides out. */
  person: UserRow | null;
  onClose: () => void;
}

/** One person: their data and every course they were assigned, with progress. */
export function PersonSheet({ open, person, onClose }: PersonSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="max-w-xl">{person && <PersonDetail person={person} />}</SheetContent>
    </Sheet>
  );
}
