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
import { studioApi, studioKeys } from "@/lib/api/studio";
import type { CourseDetail, ModuleAdmin, SlideContext, Storyboard, StoryboardScene } from "@/lib/api/types";
import { moveItem, removeAt, replaceAt } from "@/lib/array";
import { formatDuration, plural } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { narrationSeconds, SceneEditor } from "./scene-editor";
import { videoStyle } from "./steps";

const MAX_SCENES = 40;

const newSceneId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** A copy of the scene at `index`, right after it. */
function duplicateScene(scenes: StoryboardScene[], index: number): StoryboardScene[] {
  return [...scenes.slice(0, index + 1), { ...scenes[index], id: newSceneId() }, ...scenes.slice(index + 1)];
}

/** A new last scene that starts as a copy of the current last one, minus its title, points and narration. */
function appendBlankScene(scenes: StoryboardScene[]): StoryboardScene[] {
  const last = scenes[scenes.length - 1];
  return [...scenes, { ...last, id: newSceneId(), narration: "", slide: { ...last.slide, title: "", points: [] } }];
}

interface StoryboardEditorProps {
  course: CourseDetail;
  module: ModuleAdmin;
  onDirtyChange: (dirty: boolean) => void;
}

/** The module's script scene by scene; saving applies to the next video production. */
export function StoryboardEditor({ course, module, onDirtyChange }: StoryboardEditorProps) {
  const storyboard = useQuery({
    queryKey: studioKeys.storyboard(module.id),
    queryFn: () => studioApi.storyboard(module.id),
    // Dropped once the editor closes (it closes while the AI rewrites the script), so it never reopens stale.
    gcTime: 0,
  });
  if (storyboard.isPending) return <Skeleton className="h-96" />;
  if (!storyboard.data) return <QueryError query={storyboard} />;
  return (
    <StoryboardForm
      key={JSON.stringify(storyboard.data)}
      course={course}
      module={module}
      saved={storyboard.data}
      onDirtyChange={onDirtyChange}
    />
  );
}

function StoryboardForm({ course, module, saved, onDirtyChange }: StoryboardEditorProps & { saved: Storyboard }) {
  const queryClient = useQueryClient();
  const { refreshCourse } = useCourseCache();
  const [scenes, setScenes] = useState(saved.scenes);
  const [feedback, setFeedback] = useState("");
  const dirty = JSON.stringify(scenes) !== JSON.stringify(saved.scenes);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

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
      refreshCourse(course.id);
      toast.success(
        module.video ? "Guion guardado. Vuelve a producir el video para aplicar los cambios." : "Guion guardado",
      );
    },
    onError: toastError,
  });

  const rewrite = useMutation({
    mutationFn: () => studioApi.regenerateStoryboard(module.id, feedback),
    onSuccess: () => {
      setFeedback("");
      refreshCourse(course.id);
      toast.success("La IA está reescribiendo el guion de este módulo.");
    },
    onError: toastError,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {plural(scenes.length, "escena")} · unos {formatDuration(seconds)} de video
        </p>
        <Button
          onClick={() => save.mutate()}
          disabled={!dirty || scenes.some((scene) => !scene.narration.trim())}
          loading={save.isPending}
        >
          <Save /> Guardar guion
        </Button>
      </div>

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
          />
          <Button
            variant="ghost"
            className="mt-2"
            onClick={() => rewrite.mutate()}
            loading={rewrite.isPending}
            disabled={!feedback.trim()}
          >
            <RefreshCw /> Reescribir con IA
          </Button>
        </div>
      </div>
    </div>
  );
}
