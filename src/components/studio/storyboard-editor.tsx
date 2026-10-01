"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RefreshCw, Save } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { STUDIO_STALE_MS, studioApi, studioKeys } from "@/lib/api/studio";
import type { CourseDetail, ModuleAdmin, SlideContext, Storyboard, StoryboardScene } from "@/lib/api/types";
import { moveItem, removeAt, replaceAt } from "@/lib/array";
import { formatDuration, plural } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { narrationSeconds, SceneEditor } from "./scene-editor";
import { videoStyle } from "./steps";
import { useProduceModule } from "./use-produce-module";
import { useStudioCache } from "./use-studio-cache";

const MAX_SCENES = 40;

const newSceneId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** A copy of the scene at `index`, right after it. */
function duplicateScene(scenes: StoryboardScene[], index: number): StoryboardScene[] {
  return [...scenes.slice(0, index + 1), { ...scenes[index], id: newSceneId() }, ...scenes.slice(index + 1)];
}

/** A new last scene that starts as a copy of the current last one, minus its title, points and narration. */
function appendBlankScene(scenes: StoryboardScene[]): StoryboardScene[] {
  const last = scenes[scenes.length - 1];
  return [...scenes, { ...last, id: newSceneId(), narration: "", slide: { ...last.slide, title: "", points: [], icons: [] } }];
}

interface StoryboardEditorProps {
  course: CourseDetail;
  module: ModuleAdmin;
  /** The module's video is being produced: the script can't be saved or rewritten until it's done. */
  rendering: boolean;
  /** The script has edits not saved yet. */
  dirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
}

/** The module's script scene by scene; saving applies to the next video production. */
export function StoryboardEditor({ course, module, rendering, dirty, onDirtyChange }: StoryboardEditorProps) {
  // Out here: saving remounts the form with the saved copy, and the instructions must survive it.
  const [feedback, setFeedback] = useState("");
  const storyboard = useQuery({
    queryKey: studioKeys.storyboard(module.id),
    queryFn: () => studioApi.storyboard(module.id),
    // Dropped once the editor closes (it closes while the AI rewrites the script), so it never reopens stale.
    gcTime: 0,
    staleTime: STUDIO_STALE_MS,
    // Another tab may have changed it; a new copy restarts the form, so never over unsaved edits.
    refetchOnWindowFocus: !dirty,
  });
  if (storyboard.isPending) return <Skeleton className="h-96" />;
  if (!storyboard.data) return <QueryError query={storyboard} />;
  return (
    <StoryboardForm
      key={JSON.stringify(storyboard.data)}
      course={course}
      module={module}
      rendering={rendering}
      saved={storyboard.data}
      feedback={feedback}
      onFeedbackChange={setFeedback}
      onDirtyChange={onDirtyChange}
    />
  );
}

interface StoryboardFormProps extends Omit<StoryboardEditorProps, "dirty"> {
  saved: Storyboard;
  /** Owned by the editor: this form is remounted whenever the saved script changes. */
  feedback: string;
  onFeedbackChange: (feedback: string) => void;
}

function StoryboardForm({
  course,
  module,
  rendering,
  saved,
  feedback,
  onFeedbackChange: setFeedback,
  onDirtyChange,
}: StoryboardFormProps) {
  const queryClient = useQueryClient();
  const { refreshCourse } = useCourseCache();
  const { trackJobs, failed } = useStudioCache();
  const { produce } = useProduceModule(course);
  const [scenes, setScenes] = useState(saved.scenes);
  const dirty = JSON.stringify(scenes) !== JSON.stringify(saved.scenes);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // Closed (or replaced by the AI's rewrite): nothing is left unsaved.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const context = (index: number): SlideContext => ({
    course_title: course.title,
    module_label: `Módulo ${module.order}`,
    index: index + 1,
    total: scenes.length,
    ...videoStyle(course.settings),
  });
  const seconds = scenes.reduce((total, scene) => total + narrationSeconds(scene.narration), 0);

  const save = useMutation({
    mutationFn: () => studioApi.saveStoryboard(module.id, { scenes }),
    onSuccess: (stored) => {
      queryClient.setQueryData(studioKeys.storyboard(module.id), stored);
      void refreshCourse(course.id);
      if (!module.video) {
        toast.success("Guion guardado");
        return;
      }
      toast.success("Guion guardado. Vuelve a producir el video para aplicar los cambios.", {
        action: { label: "Volver a producir", onClick: () => void produce(module) },
      });
    },
    onError: failed(course.id),
  });

  const rewrite = useMutation({
    mutationFn: () => studioApi.regenerateStoryboard(module.id, feedback),
    onSuccess: (job) => {
      setFeedback("");
      trackJobs(course.id, [job]);
      void refreshCourse(course.id);
      toast.success("La IA está reescribiendo el guion de este módulo.");
    },
    onError: failed(course.id),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {plural(scenes.length, "escena")} · unos {formatDuration(seconds)} de video
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => setScenes(saved.scenes)} disabled={save.isPending}>
              Descartar cambios
            </Button>
          )}
          <Button
            onClick={() => save.mutate()}
            disabled={rendering || !dirty || scenes.some((scene) => !scene.narration.trim())}
            loading={save.isPending}
          >
            <Save /> Guardar guion
          </Button>
        </div>
      </div>
      {rendering && (
        <p role="status" className="border-l-2 border-warning bg-amber-50 px-4 py-3 text-sm">
          El video se está produciendo; edita el guion cuando termine.
        </p>
      )}

      <ol className="space-y-5" aria-label={`Escenas de ${module.title}`}>
        {scenes.map((scene, index) => (
          <SceneEditor
            key={scene.id}
            scene={scene}
            index={index}
            total={scenes.length}
            context={context(index)}
            onChange={(next) => setScenes((list) => replaceAt(list, index, next))}
            onMove={(to) => setScenes((list) => moveItem(list, index, to))}
            onDuplicate={() => setScenes((list) => duplicateScene(list, index))}
            onRemove={() => setScenes((list) => removeAt(list, index))}
          />
        ))}
      </ol>

      <div className="flex flex-col gap-6 border-t border-border pt-6 lg:flex-row lg:items-start lg:justify-between">
        {scenes.length < MAX_SCENES && (
          <Button variant="outline" onClick={() => setScenes(appendBlankScene)}>
            <Plus /> Agregar escena
          </Button>
        )}
        <div className="w-full max-w-md">
          <Label htmlFor={`rewrite-${module.id}`}>¿Prefieres que la IA lo reescriba?</Label>
          <Textarea
            id={`rewrite-${module.id}`}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Ej. más ejemplos de la planta y un tono más cercano"
            maxLength={4000}
            className="min-h-[72px]"
            aria-describedby={dirty ? `rewrite-${module.id}-hint` : undefined}
          />
          <Button
            variant="ghost"
            className="mt-2"
            onClick={() => rewrite.mutate()}
            loading={rewrite.isPending}
            disabled={!feedback.trim() || dirty || rendering}
          >
            <RefreshCw /> Reescribir con IA
          </Button>
          {dirty && (
            <p id={`rewrite-${module.id}-hint`} className="mt-1 text-xs text-muted-foreground">
              Guarda o descarta tus cambios: la IA parte del guion guardado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
