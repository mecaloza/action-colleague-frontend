"use client";

import Link from "next/link";
import { Archive, Eye, MoreHorizontal, Rocket, Trash2, Undo2 } from "lucide-react";
import { DiamondMotif } from "@/components/brand/motif";
import { BackLink } from "@/components/layout/back-link";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { CourseDetail, PublishProblem } from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";
import { useCourseActions } from "@/lib/hooks/use-course-actions";
import { StatusBadge } from "./status-badge";

function PublishProblemsDialog({ problems, onClose }: { problems: PublishProblem[] | null; onClose: () => void }) {
  return (
    <Dialog open={problems !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Falta poco para publicar</DialogTitle>
          <DialogDescription>Resuelve esto y vuelve a intentarlo:</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {problems?.map((problem, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-accent" />
              {problem.message}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Black band at the top of the editor: status, title and the publish, preview and delete actions. */
export function CourseHeader({ course }: { course: CourseDetail }) {
  const confirm = useConfirm();
  const actions = useCourseActions(course.id);
  const archived = course.status === "archived";
  const isDraft = course.status !== "published" && !archived;

  const confirmDelete = async () => {
    const confirmed = await confirm({
      title: "¿Eliminar este curso?",
      description:
        course.enrolled_count > 0
          ? `Se borrarán sus módulos, sus evaluaciones y los resultados de ${plural(course.enrolled_count, "persona")}. No se puede deshacer; si solo quieres ocultarlo, archívalo.`
          : "Se borrarán sus módulos y evaluaciones. No se puede deshacer.",
      confirmLabel: "Eliminar curso",
      destructive: true,
    });
    if (confirmed) actions.remove.mutate();
  };

  return (
    <>
      <section className="band-dark">
        <DiamondMotif className="absolute -right-6 -top-10 hidden h-[220px] w-[150px] opacity-80 md:block lg:right-10" />
        <div className="container relative z-10 py-10">
          <BackLink href="/admin/courses">Cursos</BackLink>
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex items-center gap-2">
                <StatusBadge status={course.status} />
                <span className="text-xs text-white/50">
                  {plural(course.module_count, "módulo")} · {plural(course.enrolled_count, "persona")} ·{" "}
                  {formatPercent(course.completion_rate)} completado
                </span>
              </div>
              <h1 className="display-lg text-balance text-white">{course.title}</h1>
              {course.description && <p className="mt-3 max-w-2xl text-white/70">{course.description}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline-inverse" asChild>
                <Link href={`/admin/courses/${course.id}/preview`}>
                  <Eye /> Vista previa
                </Link>
              </Button>
              {isDraft ? (
                <Button variant="accent" onClick={() => actions.publish.mutate()} loading={actions.publish.isPending}>
                  <Rocket /> Publicar
                </Button>
              ) : (
                <Button
                  variant="outline-inverse"
                  onClick={() => actions.unpublish.mutate()}
                  loading={actions.unpublish.isPending}
                >
                  <Undo2 /> {archived ? "Restaurar como borrador" : "Despublicar"}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline-inverse" size="icon" aria-label="Más acciones">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {!archived && (
                    <DropdownMenuItem onSelect={() => actions.archive.mutate()}>
                      <Archive /> Archivar curso
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem destructive onSelect={confirmDelete}>
                    <Trash2 /> Eliminar curso
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </section>

      <PublishProblemsDialog problems={actions.publishProblems} onClose={actions.dismissPublishProblems} />
    </>
  );
}
