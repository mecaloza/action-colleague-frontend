"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Film, Loader2, Plus } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { CourseDetail } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { ModuleRow } from "./module-row";
import { ModuleSheet } from "./module-sheet";
import { NewModuleDialog } from "./new-module-dialog";

export function ModulesTab({ course }: { course: CourseDetail }) {
  const queryClient = useQueryClient();
  const { refreshCourse } = useCourseCache();
  const [modules, setModules] = useState(course.modules);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation({
    mutationFn: (ids: number[]) => coursesApi.reorderModules(course.id, ids),
    onSuccess: (saved) =>
      queryClient.setQueryData<CourseDetail>(courseKeys.detail(course.id), (current) => current && { ...current, modules: saved }),
    onError: toastError,
    onSettled: () => refreshCourse(course.id),
  });
  // Local copy so a dropped module lands instantly. It follows the server again once the save settles:
  // a poll that answers while the save is in flight still carries the old order.
  useEffect(() => {
    if (!reorder.isPending) setModules(course.modules);
  }, [course.modules, reorder.isPending]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || reorder.isPending) return;
    const from = modules.findIndex((m) => m.id === active.id);
    const to = modules.findIndex((m) => m.id === over.id);
    const next = arrayMove(modules, from, to).map((m, index) => ({ ...m, order: index + 1 }));
    setModules(next);
    reorder.mutate(next.map((m) => m.id));
  };

  const openModule = modules.find((m) => m.id === openId) ?? null;

  // dnd-kit speaks English by default ("Picked up draggable item 12").
  const titleOf = (id: UniqueIdentifier) => `«${modules.find((m) => m.id === id)?.title ?? "Módulo"}»`;
  const place = (id: UniqueIdentifier) => `posición ${modules.findIndex((m) => m.id === id) + 1} de ${modules.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Moviendo ${titleOf(active.id)}, ${place(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} está en la ${place(over.id)}.` : `${titleOf(active.id)} está fuera de la lista.`),
    onDragEnd: ({ active, over }) => (over ? `${titleOf(active.id)} quedó en la ${place(over.id)}.` : `${titleOf(active.id)} volvió a su lugar.`),
    onDragCancel: ({ active }) => `Movimiento cancelado: ${titleOf(active.id)} volvió a su lugar.`,
  };
  const screenReaderInstructions = {
    draggable:
      "Para mover el módulo, pulsa espacio o Enter. Usa las flechas arriba y abajo para cambiarlo de lugar y espacio o Enter para soltarlo; Escape cancela.",
  };

  const addModuleButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus /> Agregar módulo
    </Button>
  );

  return (
    <div>
      <SectionHeader
        title="Módulos"
        description="Arrastra para reordenar. Cada persona avanza en este orden y desbloquea el siguiente al completar el anterior."
        action={
          <div className="flex items-center gap-2">
            {reorder.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {addModuleButton}
          </div>
        }
      />

      {modules.length === 0 ? (
        <EmptyState
          icon={<Film />}
          title="Este curso aún no tiene módulos"
          description="Agrega un módulo con un video, un documento o un texto de lectura."
          action={addModuleButton}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{ announcements, screenReaderInstructions }}
        >
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {modules.map((module) => (
                <ModuleRow key={module.id} module={module} onOpen={() => setOpenId(module.id)} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <NewModuleDialog courseId={course.id} open={creating} onOpenChange={setCreating} onCreated={setOpenId} />
      <ModuleSheet module={openModule} courseId={course.id} onClose={() => setOpenId(null)} />
    </div>
  );
}
