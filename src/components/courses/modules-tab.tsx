"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Film, Loader2, Plus } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { coursesApi } from "@/lib/api/courses";
import type { CourseDetail } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { ModuleRow } from "./module-row";
import { ModuleSheet } from "./module-sheet";
import { NewModuleDialog } from "./new-module-dialog";

export function ModulesTab({ course }: { course: CourseDetail }) {
  const { refreshCourse } = useCourseCache();
  const [modules, setModules] = useState(course.modules);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  // Local copy so a dropped module lands instantly; it follows the server whenever the course refetches.
  useEffect(() => setModules(course.modules), [course.modules]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation({
    mutationFn: (ids: number[]) => coursesApi.reorderModules(course.id, ids),
    onError: (error) => {
      setModules(course.modules);
      toastError(error);
    },
    onSettled: () => refreshCourse(course.id),
  });

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = modules.findIndex((m) => m.id === active.id);
    const to = modules.findIndex((m) => m.id === over.id);
    const next = arrayMove(modules, from, to).map((m, index) => ({ ...m, order: index + 1 }));
    setModules(next);
    reorder.mutate(next.map((m) => m.id));
  };

  const openModule = modules.find((m) => m.id === openId) ?? null;

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
