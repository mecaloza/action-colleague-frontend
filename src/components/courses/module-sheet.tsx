"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
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
import { ModuleMedia } from "./module-media";
import { ModuleVideo } from "./module-video";

interface ModuleFormProps {
  module: ModuleAdmin;
  courseId: number;
  startRecording: boolean;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onUploadingChange: (uploading: boolean) => void;
}

function ModuleForm({ module, courseId, startRecording, onClose, onDirtyChange, onUploadingChange }: ModuleFormProps) {
  const confirm = useConfirm();
  const { refreshCourse } = useCourseCache();
  const [initial, setInitial] = useState(module); // the values this form started from (or last saved)
  const [uploading, setUploading] = useState(false);
  useEffect(() => onUploadingChange(uploading), [uploading, onUploadingChange]);
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description);
  const [content, setContent] = useState(module.content_text);
  // Only what the admin edited here: other fields may have changed on the server meanwhile.
  const changes = {
    ...(title !== initial.title && { title: title.trim() }),
    ...(description !== initial.description && { description }),
    ...(content !== initial.content_text && { content_text: content }),
  };
  const dirty = Object.keys(changes).length > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const finish = (message: string) => {
    toast.success(message);
    refreshCourse(courseId);
    onClose();
  };

  const save = useMutation({
    mutationFn: () => coursesApi.updateModule(module.id, changes),
    onSuccess: (saved) => {
      if (!uploading) return finish("Módulo guardado");
      // A file is still uploading in this panel: closing it would cancel the upload, so stay.
      toast.success("Módulo guardado");
      refreshCourse(courseId);
      setInitial(saved);
      setTitle(saved.title);
      setDescription(saved.description);
      setContent(saved.content_text);
    },
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
        {module.generation_status === "failed" && module.source === "ai" && (
          <p role="alert" className="flex items-start gap-2 border-l-2 border-destructive bg-red-50 px-3 py-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            {module.generation_error || "La generación falló. Vuelve a intentarlo."}
          </p>
        )}
        {/* AI videos are produced by the studio; every other module manages its own media here. */}
        {module.source === "ai" ? (
          <ModuleVideo module={module} />
        ) : (
          <ModuleMedia module={module} startRecording={startRecording} onUploadingChange={setUploading} />
        )}
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
            placeholder="Texto que acompaña al video o que se lee como módulo de lectura"
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
  startRecording = false,
  onClose,
}: {
  module: ModuleAdmin | null;
  courseId: number;
  /** Open the recording studio as soon as the sheet opens ("Grabarme"). */
  startRecording?: boolean;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const dirty = useRef(false);
  const setDirty = useRef((value: boolean) => {
    dirty.current = value;
  }).current;
  const uploading = useRef(false);
  const setUploading = useRef((value: boolean) => {
    uploading.current = value;
  }).current;

  // Escape, the overlay or the close button: ask before cancelling an upload or dropping unsaved edits.
  const requestClose = async () => {
    if (
      uploading.current &&
      !(await confirm({
        title: "¿Cerrar y cancelar la subida?",
        description: "El archivo todavía se está subiendo; si cierras el panel ahora, la subida se cancela.",
        confirmLabel: "Cerrar de todos modos",
        destructive: true,
      }))
    )
      return;
    if (
      dirty.current &&
      !(await confirm({ title: "¿Descartar los cambios sin guardar?", confirmLabel: "Descartar", destructive: true }))
    )
      return;
    dirty.current = false;
    onClose();
  };

  return (
    <Sheet open={module !== null} onOpenChange={(open) => !open && void requestClose()}>
      <SheetContent>
        {/* Keyed by module: each one opens with its own form, filled from the saved values. */}
        {module && (
          <ModuleForm
            key={module.id}
            module={module}
            courseId={courseId}
            startRecording={startRecording}
            onClose={() => {
              dirty.current = false;
              onClose();
            }}
            onDirtyChange={setDirty}
            onUploadingChange={setUploading}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
