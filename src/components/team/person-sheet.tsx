"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { PersonCourses } from "@/components/people/person-courses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { UserRow } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

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
        {/* The quick view; the page has their paths, each module's results, certificates and latest activity. */}
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href={`/admin/team/${person.id}`}>
            Ver ficha completa <ArrowRight />
          </Link>
        </Button>
      </SheetHeader>
      <SheetBody className="space-y-8">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Detail label="Perfil">{person.profile?.name ?? "Sin perfil"}</Detail>
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
          <PersonCourses userId={person.id} />
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

/** One person at a glance: their data and every course they were assigned, with progress. */
export function PersonSheet({ open, person, onClose }: PersonSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="max-w-xl">{person && <PersonDetail person={person} />}</SheetContent>
    </Sheet>
  );
}
