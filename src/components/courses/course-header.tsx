"use client";

import Link from "next/link";
import { Archive, Eye, MoreHorizontal, Rocket, Sparkles, Trash2, Undo2 } from "lucide-react";
import { DiamondMotif } from "@/components/brand/motif";
import { BackLink } from "@/components/layout/back-link";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { CourseQaSummary } from "@/components/studio/qa-chip";
import { QaReportSheet, useQaSheet } from "@/components/studio/qa-report-sheet";
import { isBusy } from "@/components/studio/steps";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { CourseDetail, PublishProblem } from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";
import { useCourseActions } from "@/lib/hooks/use-course-actions";
import { PHONE, useMediaQuery } from "@/lib/hooks/use-media-query";
import { StatusBadge } from "./status-badge";

/**
 * A problem that is a video's review with critical findings still open (what the parameters can make block
 * publishing): the module's other problems (being produced, no content) come first on the server too.
 */
function reviewProblem(problem: PublishProblem, course: CourseDetail): number | null {
  const reviewed = course.modules.find((each) => each.id === problem.module_id);
  return reviewed?.review?.critical && !isBusy(reviewed) ? reviewed.id : null;
}

interface PublishProblemsDialogProps {
  course: CourseDetail;
  problems: PublishProblem[] | null;
  onClose: () => void;
  /** Opens a video's review (the dialog closes). */
  onReview: (moduleId: number) => void;
}

function PublishProblemsDialog({ course, problems, onClose, onReview }: PublishProblemsDialogProps) {
  // Each problem with the video's review it is about, if any.
  const listed = (problems ?? []).map((problem) => ({ problem, reviewed: reviewProblem(problem, course) }));
  return (
    <Dialog open={problems !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Falta poco para publicar</DialogTitle>
          <DialogDescription>Resuelve esto y vuelve a intentarlo:</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {listed.map(({ problem, reviewed }, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-accent" />
              <div className="min-w-0 space-y-1">
                <p className="break-words">{problem.message}</p>
                {reviewed !== null && (
                  <Button variant="link" className="text-[13px]" onClick={() => onReview(reviewed)}>
                    Ver la revisión
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {/* How the review of the course's videos went (those linked above aren't listed again). */}
        <CourseQaSummary
          course={course}
          onOpen={onReview}
          linked={listed.flatMap(({ reviewed }) => (reviewed === null ? [] : [reviewed]))}
          className="mt-6 border-t border-border pt-4"
        />
        <DialogFooter>
          <Button onClick={onClose}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Made in the AI studio: an AI course that is empty, has scripts, is generating, or has modules still waiting for
 * their first script. AI courses brought from the previous app (videos without a script) are edited here instead.
 */
function madeInStudio(course: CourseDetail): boolean {
  if (course.source !== "ai") return false;
  return (
    !course.modules.length ||
    course.modules.some(
      (module) =>
        module.scene_count > 0 ||
        isBusy(module) ||
        (module.source === "ai" && !module.video && !module.content_text.trim()),
    )
  );
}

const PUBLISH_ID = "course-publish";

/** Black band at the top of the editor: status, title and the publish, preview and delete actions. */
export function CourseHeader({ course }: { course: CourseDetail }) {
  const confirm = useConfirm();
  const actions = useCourseActions(course.id);
  // A video's review, opened from what keeps the course from being published.
  const qa = useQaSheet();
  const phone = useMediaQuery(PHONE);
  const archived = course.status === "archived";
  const isDraft = course.status !== "published" && !archived;
  const studio = madeInStudio(course);
  const studioHref = `/admin/courses/${course.id}/studio`;
  const previewHref = `/admin/courses/${course.id}/preview`;
  const unpublishLabel = archived ? "Restaurar como borrador" : "Despublicar";

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

  const confirmUnpublish = async () => {
    const confirmed = await confirm({
      title: archived ? "¿Restaurar como borrador?" : "¿Despublicar este curso?",
      description: "Las personas asignadas no lo verán hasta que lo publiques de nuevo.",
      confirmLabel: archived ? "Restaurar" : "Despublicar",
    });
    if (confirmed) actions.unpublish.mutate();
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
            {/* On a phone one action stays in sight (publishing a draft, or the preview) and the rest go to the menu. */}
            <div className="flex flex-wrap items-center gap-3">
              {studio && (
                <Button variant="outline-inverse" className="hidden sm:inline-flex" asChild>
                  <Link href={studioHref}>
                    <Sparkles /> Estudio IA
                  </Link>
                </Button>
              )}
              <Button variant="outline-inverse" className={isDraft ? "hidden sm:inline-flex" : "flex-1 sm:flex-none"} asChild>
                <Link href={previewHref}>
                  <Eye /> Vista previa
                </Link>
              </Button>
              {isDraft ? (
                <Button
                  id={PUBLISH_ID}
                  variant="accent"
                  className="flex-1 sm:flex-none"
                  onClick={() => actions.publish.mutate()}
                  loading={actions.publish.isPending}
                >
                  <Rocket /> Publicar
                </Button>
              ) : (
                <Button
                  variant="outline-inverse"
                  className="hidden sm:inline-flex"
                  onClick={confirmUnpublish}
                  loading={actions.unpublish.isPending}
                >
                  <Undo2 /> {unpublishLabel}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline-inverse" size="icon" aria-label="Más acciones">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {phone && studio && (
                    <DropdownMenuItem asChild>
                      <Link href={studioHref}>
                        <Sparkles /> Estudio IA
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {phone && isDraft && (
                    <DropdownMenuItem asChild>
                      <Link href={previewHref}>
                        <Eye /> Vista previa
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {phone && !isDraft && (
                    <DropdownMenuItem onSelect={confirmUnpublish} disabled={actions.unpublish.isPending}>
                      <Undo2 /> {unpublishLabel}
                    </DropdownMenuItem>
                  )}
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

      <PublishProblemsDialog
        course={course}
        problems={actions.publishProblems}
        onClose={actions.dismissPublishProblems}
        onReview={(moduleId) => {
          actions.dismissPublishProblems();
          qa.show(moduleId);
        }}
      />
      {/* What opened it went with the dialog: as it closes, the focus goes back to publishing. */}
      <QaReportSheet course={course} {...qa.sheet} focusFallbackId={PUBLISH_ID} />
    </>
  );
}
