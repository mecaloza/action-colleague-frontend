"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { coursesApi } from "@/lib/api/courses";
import type { ModuleAdmin } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { ModuleVideo } from "./module-video";

interface ModuleFormProps {
  module: ModuleAdmin;
  courseId: number;
  onClose: () => void;
}

function ModuleForm({ module, courseId, onClose }: ModuleFormProps) {
  const confirm = useConfirm();
  const { refreshCourse } = useCourseCache();
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description);
  const [content, setContent] = useState(module.content_text);
  const dirty = title !== module.title || description !== module.description || content !== module.content_text;

  const finish = (message: string) => {
    toast.success(message);
    refreshCourse(courseId);
    onClose();
  };

  const save = useMutation({
    mutationFn: () => coursesApi.updateModule(module.id, { title: title.trim(), description, content_text: content }),
    onSuccess: () => finish("Módulo guardado"),
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: () => coursesApi.removeModule(module.id),
    onSuccess: () => finish("Módulo eliminado"),
    onError: toastError,
  });

  const confirmRemove = async () => {
    const confirmed = await confirm({
      title: "¿Eliminar este módulo?",
      description: "Se borrará su contenido, su evaluación y el progreso de las personas en él.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (confirmed) remove.mutate();
  };

  return (
    <>
      <SheetHeader>
        <p className="eyebrow mb-2">Módulo {module.order}</p>
        <SheetTitle className="font-display text-2xl font-medium tracking-tightest">{module.title}</SheetTitle>
        <SheetDescription className="sr-only">Editar el módulo</SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-6">
        <ModuleVideo module={module} />
        <div>
          <Label htmlFor="module-title">Título</Label>
          <Input id="module-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} />
        </div>
        <div>
          <Label htmlFor="module-description">Descripción corta</Label>
          <Textarea
            id="module-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-[72px]"
            placeholder="Qué aprenderá la persona en este módulo"
          />
        </div>
        <div>
          <Label htmlFor="module-content">Contenido de lectura</Label>
          <Textarea
            id="module-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[220px] font-[450]"
            placeholder="Texto que acompaña al video o que se lee como módulo de lectura (admite Markdown)"
          />
        </div>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" className="text-destructive hover:bg-red-50" onClick={confirmRemove} loading={remove.isPending}>
          <Trash2 /> Eliminar
        </Button>
        <Button onClick={() => save.mutate()} disabled={!dirty || !title.trim()} loading={save.isPending}>
          Guardar cambios
        </Button>
      </SheetFooter>
    </>
  );
}

export function ModuleSheet({
  module,
  courseId,
  onClose,
}: {
  module: ModuleAdmin | null;
  courseId: number;
  onClose: () => void;
}) {
  return (
    <Sheet open={module !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {/* Keyed by module: each one opens with its own form, filled from the saved values. */}
        {module && <ModuleForm key={module.id} module={module} courseId={courseId} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}
