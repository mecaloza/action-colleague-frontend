"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { GripVertical, Layers, Loader2, Plus, X } from "lucide-react";
import { focusMoveButton, MoveButtons } from "@/components/courses/move-buttons";
import { StatusBadge } from "@/components/courses/status-badge";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { MAX_PATH_COURSES, pathsApi } from "@/lib/api/paths";
import type { PathCourse, PathDetail } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { useOpening } from "@/lib/hooks/use-opening";
import { usePathCache } from "@/lib/hooks/use-path-cache";
import { useStableUrl } from "@/lib/hooks/use-stable-url";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { AddCoursesDialog } from "./add-courses-dialog";

/** The id of a course's "Quitar": the focus goes there once another course leaves the path. */
const removeButtonId = (courseId: number) => `path-course-${courseId}-remove`;

/** Why a course of the path doesn't count for its people yet. */
function hiddenReason(course: PathCourse): string | null {
  if (course.status === "draft") return "Las personas lo verán cuando lo publiques";
  if (course.status === "archived") return "Archivado: no cuenta para la ruta";
  return null;
}

interface PathCourseRowProps {
  course: PathCourse;
  index: number;
  total: number;
  /** A change is being saved: the arrows wait for it. */
  moving: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/** One step of the path: its number on the rail, dragged by its handle or moved with its arrows. */
function PathCourseRow({ course, index, total, moving, onMove, onRemove }: PathCourseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.course_id });
  const cover = useStableUrl(course.cover_url);
  const reason = hiddenReason(course);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative flex gap-3 sm:gap-4", isDragging && "z-10")}
    >
      {/* The rail: the step's number, and a line down to the next one. */}
      <div className="flex flex-col items-center" aria-hidden>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink-950 font-display text-lg font-medium text-white">
          {index + 1}
        </span>
        {index < total - 1 && <span className="w-px flex-1 bg-ink-800/30" />}
      </div>
      <div
        className={cn(
          "mb-3 flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 border border-border bg-white p-3 transition-shadow sm:flex-nowrap sm:p-4",
          isDragging && "shadow-2xl",
        )}
      >
        <button
          className="-ml-1.5 flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground hover:text-ink-800 active:cursor-grabbing"
          aria-label={`Reordenar ${course.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="relative hidden h-14 w-24 shrink-0 overflow-hidden bg-ink-900 sm:block">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-white/40">
              <Layers className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 basis-40">
          <Link href={`/admin/courses/${course.course_id}`} className="-my-2 block break-words py-2 font-semibold hover:text-accent">
            <span className="sr-only">Curso {index + 1}: </span>
            {course.title}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <StatusBadge status={course.status} />
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" aria-hidden /> {plural(course.module_count, "módulo")}
            </span>
            {reason && <span>· {reason}</span>}
          </p>
        </div>
        <div className="ml-auto flex items-center">
          <MoveButtons
            id={`path-course-${course.course_id}`}
            label={course.title}
            index={index}
            total={total}
            busy={moving}
            onMove={onMove}
          />
          {/* Waits while a change is saved, as the arrows: each save sends the whole list. */}
          <Button
            variant="ghost"
            size="icon-sm"
            id={removeButtonId(course.course_id)}
            onClick={() => !moving && onRemove()}
            aria-label={`Quitar ${course.title} de la ruta`}
            aria-disabled={moving || undefined}
            className={cn(moving && "opacity-45")}
          >
            <X />
          </Button>
        </div>
      </div>
    </li>
  );
}

/** The path's courses, in the order its people take them: add, reorder and remove. */
export function PathCoursesTab({ path }: { path: PathDetail }) {
  const confirm = useConfirm();
  const { storePath } = usePathCache();
  const adding = useOpening(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [courses, setCourses] = useState(path.courses);
  const room = MAX_PATH_COURSES - courses.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // The whole list, in order, every time (to add, remove or reorder).
  const save = useMutation({
    mutationFn: (courseIds: number[]) => pathsApi.setCourses(path.id, courseIds),
    onSuccess: (saved) => void storePath(saved),
    onError: toastError,
  });
  // Local copy so a moved course lands instantly. It follows the server again once the save settles (a failed one
  // goes back to the saved order).
  useEffect(() => {
    if (!save.isPending) setCourses(path.courses);
  }, [path.courses, save.isPending]);

  const reorder = (from: number, to: number) => {
    const next = arrayMove(courses, from, to);
    setCourses(next);
    save.mutate(next.map((course) => course.course_id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || save.isPending) return;
    reorder(
      courses.findIndex((course) => course.course_id === active.id),
      courses.findIndex((course) => course.course_id === over.id),
    );
  };

  // The arrows move a course without dragging (a finger, a keyboard): the focus follows it to its new place, and
  // screen readers hear where it landed.
  const [moved, setMoved] = useState("");
  const refocus = useRef<{ id: number; direction: -1 | 1 } | null>(null);
  const move = (index: number, direction: -1 | 1) => {
    const { course_id, title } = courses[index];
    refocus.current = { id: course_id, direction };
    reorder(index, index + direction);
    setMoved(`«${title}» quedó en la posición ${index + direction + 1} de ${courses.length}.`);
  };
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    focusMoveButton(`path-course-${target.id}`, target.direction);
  }, [courses]);

  const add = (courseIds: number[]) =>
    save.mutate([...courses.map((course) => course.course_id), ...courseIds], {
      onSuccess: () => {
        toast.success(courseIds.length === 1 ? "Curso agregado a la ruta" : `${courseIds.length} cursos agregados a la ruta`);
        adding.hide();
      },
    });

  // A course that leaves takes its "Quitar" with it: the focus goes to the "Quitar" now in its place (or the last
  // one), or to "Agregar cursos" when none is left, instead of falling to the top of the page.
  const removed = useRef<{ id: number; index: number } | null>(null);
  const askRemove = async (course: PathCourse, index: number) => {
    const confirmed = await confirm({
      title: `¿Quitar «${course.title}» de la ruta?`,
      description: "Sus personas conservan el curso y su avance; deja de contar para la ruta.",
      confirmLabel: "Quitar de la ruta",
      destructive: true,
    });
    if (!confirmed) return;
    save.mutate(
      courses.filter((other) => other.course_id !== course.course_id).map((other) => other.course_id),
      {
        onSuccess: () => {
          removed.current = { id: course.course_id, index };
          toast.success(`«${course.title}» salió de la ruta`);
        },
      },
    );
  };
  useEffect(() => {
    const gone = removed.current;
    if (!gone || courses.some((course) => course.course_id === gone.id)) return;
    removed.current = null;
    const next = courses[Math.min(gone.index, courses.length - 1)];
    (next ? document.getElementById(removeButtonId(next.course_id)) : addButton.current)?.focus();
  }, [courses]);

  // dnd-kit speaks English by default ("Picked up draggable item 12").
  const titleOf = (id: UniqueIdentifier) => `«${courses.find((course) => course.course_id === id)?.title ?? "Curso"}»`;
  const place = (id: UniqueIdentifier) =>
    `posición ${courses.findIndex((course) => course.course_id === id) + 1} de ${courses.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Moviendo ${titleOf(active.id)}, ${place(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} está en la ${place(over.id)}.` : `${titleOf(active.id)} está fuera de la lista.`),
    onDragEnd: ({ active, over }) => (over ? `${titleOf(active.id)} quedó en la ${place(over.id)}.` : `${titleOf(active.id)} volvió a su lugar.`),
    onDragCancel: ({ active }) => `Movimiento cancelado: ${titleOf(active.id)} volvió a su lugar.`,
  };
  const screenReaderInstructions = {
    draggable:
      "Para mover el curso, pulsa espacio o Enter. Usa las flechas arriba y abajo para cambiarlo de lugar y espacio o Enter para soltarlo; Escape cancela.",
  };

  const addCourses = (ref?: React.Ref<HTMLButtonElement>) => (
    <Button ref={ref} onClick={() => adding.show(null)} disabled={room <= 0}>
      <Plus /> Agregar cursos
    </Button>
  );

  return (
    <div>
      <SectionHeader
        title="Cursos"
        description={
          path.settings.sequential
            ? "Se toman en este orden: cada curso se abre al completar el anterior. Arrastra o usa las flechas para reordenar."
            : "Se pueden tomar en cualquier orden; este es el sugerido. Arrastra o usa las flechas para reordenar."
        }
        action={
          <div className="flex items-center gap-2">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Guardando" />}
            {addCourses(addButton)}
          </div>
        }
      />
      {room <= 0 && <p className="mb-4 text-sm text-muted-foreground">La ruta ya tiene el máximo de {MAX_PATH_COURSES} cursos.</p>}

      {courses.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="Esta ruta aún no tiene cursos"
          description="Agrega los cursos en el orden en que se deben tomar. Puedes cambiar el orden después."
          action={addCourses()}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{ announcements, screenReaderInstructions }}
        >
          <SortableContext items={courses.map((course) => course.course_id)} strategy={verticalListSortingStrategy}>
            <ol aria-label="Cursos de la ruta, en orden">
              {courses.map((course, index) => (
                <PathCourseRow
                  key={course.course_id}
                  course={course}
                  index={index}
                  total={courses.length}
                  moving={save.isPending}
                  onMove={(direction) => move(index, direction)}
                  onRemove={() => void askRemove(course, index)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
      <p aria-live="polite" className="sr-only">
        {moved}
      </p>

      <AddCoursesDialog
        key={adding.key}
        open={adding.open}
        onOpenChange={(open) => !open && !save.isPending && adding.hide()}
        excludedIds={new Set(courses.map((course) => course.course_id))}
        room={room}
        saving={save.isPending}
        onAdd={add}
      />
    </div>
  );
}
