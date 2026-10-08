"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, History, ScanSearch, Sparkles, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { reviewable, reviewLook } from "@/components/studio/qa";
import { ReviewBadgeLabel } from "@/components/studio/qa-chip";
import type { RevisionTab } from "@/components/studio/revision-sheet";
import { StaleVideoNotice, usePendingRevision } from "@/components/studio/revision-status";
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

/** The reading changed on the server while the admin edited it here. */
const READING_CHANGED = "La lectura cambió mientras la editabas (por ejemplo, al aplicar o deshacer un cambio al guion).";

/** What the panel offers for an AI module's script: asking the AI for a change, its history, producing it again. */
interface ScriptActions {
  /** Opens "Cambios al guion" over this panel, on a new change or on the history. */
  onRequestChange: (moduleId: number, tab: RevisionTab) => void;
  /** Produces the module's video again (the script changed since it was made). */
  onProduce: (module: ModuleAdmin) => void;
  producingId: number | null;
}

interface ModuleFormProps {
  module: ModuleAdmin;
  courseId: number;
  startRecording: boolean;
  script?: ScriptActions;
  onOpenReview?: (moduleId: number) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onUploadingChange: (uploading: boolean) => void;
}

/** The automatic review of an AI module's video ("Revisión de calidad"): how it went, and a way into it. */
function VideoReviewSection({ module, onOpen }: { module: ModuleAdmin; onOpen: () => void }) {
  const review = module.review ?? null;
  const look = reviewLook(review);
  return (
    <section aria-labelledby="module-video-review" className="space-y-3 border-l-2 border-border bg-mist/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="module-video-review" className="text-[11px] font-bold uppercase tracking-label text-ink-700">
          Revisión de calidad
        </h3>
        <ReviewBadgeLabel look={look} />
      </div>
      <p className="text-sm text-muted-foreground">{look.sentence}</p>
      <Button variant="outline" size="sm" onClick={onOpen}>
        <ScanSearch /> {review ? "Ver la revisión" : "Revisar el video"}
      </Button>
    </section>
  );
}

/** An AI module's script: a change to ask the AI for (or one waiting), its history, a video that no longer matches. */
function ScriptChanges({ module, script }: { module: ModuleAdmin; script: ScriptActions }) {
  const pending = usePendingRevision(module, "script");
  return (
    <section aria-labelledby="module-script-changes" className="space-y-3 border-l-2 border-accent bg-accent-soft/50 px-4 py-3">
      <h3 id="module-script-changes" className="text-[11px] font-bold uppercase tracking-label text-ink-700">
        Guion del video
      </h3>
      <StaleVideoNotice
        module={module}
        onProduce={() => script.onProduce(module)}
        producing={script.producingId === module.id}
      />
      <p className="text-sm text-muted-foreground">
        {pending
          ? "Hay un cambio de la IA esperando tu revisión."
          : "Pide a la IA un ajuste puntual: propone solo lo que cambia y lo revisas antes de aplicarlo."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => script.onRequestChange(module.id, "change")}>
          <Sparkles /> Pedir un cambio
        </Button>
        <Button variant="ghost" size="sm" onClick={() => script.onRequestChange(module.id, "history")}>
          <History /> Historial de cambios
        </Button>
      </div>
    </section>
  );
}

function ModuleForm({
  module,
  courseId,
  startRecording,
  script,
  onOpenReview,
  onClose,
  onDirtyChange,
  onUploadingChange,
}: ModuleFormProps) {
  const confirm = useConfirm();
  const { refreshCourse } = useCourseCache();
  const [initial, setInitial] = useState(module); // the values this form started from (or last saved)
  const [uploading, setUploading] = useState(false);
  useEffect(() => onUploadingChange(uploading), [uploading, onUploadingChange]);
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description);
  const [content, setContent] = useState(module.content_text);
  // The reading changed on the server while this panel was open (a change to the script applied or undone over it):
  // shown, unless it was edited here.
  const [serverReading, setServerReading] = useState(module.content_text);
  if (module.content_text !== serverReading) {
    setServerReading(module.content_text);
    if (content === initial.content_text) {
      setContent(module.content_text);
      setInitial((current) => ({ ...current, content_text: module.content_text }));
    }
  }
  // Edited here while it changed there: saving would replace the new one, so the panel says it (and asks first).
  const readingOutdated =
    serverReading !== initial.content_text && content !== initial.content_text && content !== serverReading;
  const takeNewReading = () => {
    setContent(serverReading);
    setInitial((current) => ({ ...current, content_text: serverReading }));
  };
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

  const submit = async () => {
    if (
      readingOutdated &&
      !(await confirm({
        title: "¿Guardar tu versión de la lectura?",
        description: `${READING_CHANGED} Si guardas, tu versión reemplaza la nueva.`,
        confirmLabel: "Guardar mi versión",
      }))
    )
      return;
    save.mutate();
  };

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
        {onOpenReview && reviewable(module) && (
          <VideoReviewSection module={module} onOpen={() => onOpenReview(module.id)} />
        )}
        {module.source === "ai" && module.scene_count > 0 && script && <ScriptChanges module={module} script={script} />}
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
            aria-describedby={readingOutdated ? "module-content-outdated" : undefined}
          />
          <div aria-live="polite">
            {readingOutdated && (
              <p className="mt-2 border-l-2 border-warning bg-amber-50 px-3 py-2 text-sm">
                <span id="module-content-outdated">{READING_CHANGED} Si guardas, tu versión reemplaza la nueva.</span>{" "}
                <Button variant="link" className="text-[13px]" onClick={takeNewReading}>
                  Usar la lectura nueva
                </Button>
              </p>
            )}
          </div>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" className="text-destructive hover:bg-red-50" onClick={confirmRemove} loading={remove.isPending}>
          <Trash2 /> Eliminar
        </Button>
        <Button onClick={() => void submit()} disabled={!dirty || !title.trim()} loading={save.isPending}>
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
  script,
  onOpenReview,
  onClose,
}: {
  module: ModuleAdmin | null;
  courseId: number;
  /** Open the recording studio as soon as the sheet opens ("Grabarme"). */
  startRecording?: boolean;
  /** What it offers for an AI module's script. */
  script?: ScriptActions;
  /** Opens the review of an AI module's video, over this panel. */
  onOpenReview?: (moduleId: number) => void;
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
            script={script}
            onOpenReview={onOpenReview}
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
