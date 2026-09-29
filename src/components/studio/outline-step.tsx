"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { courseKeys } from "@/lib/api/courses";
import { studioApi } from "@/lib/api/studio";
import type { CourseDetail, CourseOutline, Job, OutlineModule } from "@/lib/api/types";
import { moveItem, removeAt, replaceAt } from "@/lib/array";
import { plural } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { initialBrief } from "./brief-form";
import { JobStatus } from "./job-status";
import { ListEditor } from "./list-editor";
import { blankModule, ModuleCard } from "./outline-module-card";
import { useProposeOutline } from "./use-propose-outline";

const MAX_MODULES = 12;

interface OutlineStepProps {
  course: CourseDetail;
  outline: CourseOutline | null;
  /** The outline job in progress, if the AI is still writing it. */
  job: Job | null;
  onApproved: () => void;
}

/** The AI's proposal: edit it, ask for another one with instructions, or approve it. */
export function OutlineStep({ course, outline, job, onApproved }: OutlineStepProps) {
  if (job) {
    return (
      <div className="mx-auto max-w-2xl border border-border bg-white p-8">
        <p className="eyebrow mb-3">Estructura</p>
        <h2 className="display-md mb-6">La IA está armando tu curso</h2>
        <JobStatus job={job} fallback="Proponiendo módulos y objetivos" />
        <p className="mt-6 text-sm text-muted-foreground">
          Suele tardar menos de un minuto. Puedes salir: el curso queda guardado.
        </p>
      </div>
    );
  }
  if (!outline) return null;
  // Keyed by the proposal: a new one (regenerated) starts a fresh draft.
  return <OutlineEditor key={JSON.stringify(outline)} course={course} outline={outline} onApproved={onApproved} />;
}

/** What is saved on approval: no blank objectives or key points. */
function withoutBlanks(outline: CourseOutline): CourseOutline {
  const filled = (items: string[]) => items.filter((item) => item.trim());
  return {
    ...outline,
    objectives: filled(outline.objectives),
    modules: outline.modules.map((module) => ({ ...module, key_points: filled(module.key_points) })),
  };
}

interface OutlineDetailsProps {
  outline: CourseOutline;
  onChange: (changes: Partial<CourseOutline>) => void;
}

/** The fields of the proposal that belong to the whole course: title, description, audience and objectives. */
function OutlineDetails({ outline, onChange }: OutlineDetailsProps) {
  return (
    <div className="space-y-4 border border-border bg-white p-6">
      <div>
        <Label htmlFor="outline-title">Título del curso</Label>
        <Input
          id="outline-title"
          value={outline.title}
          onChange={(event) => onChange({ title: event.target.value })}
          maxLength={300}
          className="font-display text-xl"
        />
      </div>
      <div>
        <Label htmlFor="outline-description">Descripción</Label>
        <Textarea
          id="outline-description"
          value={outline.description}
          onChange={(event) => onChange({ description: event.target.value })}
          maxLength={5000}
        />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Label htmlFor="outline-audience">Audiencia</Label>
          <Input
            id="outline-audience"
            value={outline.audience}
            onChange={(event) => onChange({ audience: event.target.value })}
            maxLength={500}
          />
        </div>
        <ListEditor
          label="Objetivos"
          values={outline.objectives}
          onChange={(objectives) => onChange({ objectives })}
          placeholder="Al terminar, la persona podrá…"
          max={8}
        />
      </div>
    </div>
  );
}

interface OutlineEditorProps {
  course: CourseDetail;
  outline: CourseOutline;
  onApproved: () => void;
}

function OutlineEditor({ course, outline, onApproved }: OutlineEditorProps) {
  const queryClient = useQueryClient();
  const { refreshCourse } = useCourseCache();
  const [draft, setDraft] = useState(outline);
  const [feedback, setFeedback] = useState("");
  const { propose, status } = useProposeOutline();
  const update = (changes: Partial<CourseOutline>) => setDraft((current) => ({ ...current, ...changes }));
  const setModules = (modules: OutlineModule[]) => update({ modules });
  const minutes = draft.modules.reduce((total, module) => total + module.estimated_minutes, 0);
  const incomplete = !draft.title.trim() || draft.modules.some((module) => !module.title.trim());

  const approve = useMutation({
    mutationFn: async () => {
      const updated = await studioApi.applyOutline(course.id, withoutBlanks(draft));
      await studioApi.draft(course.id); // scripts, reading and quiz of every module, in the background
      return updated;
    },
    onSuccess: (updated) => {
      // The content step needs the new modules at once; the refetch adds the drafting that just started.
      queryClient.setQueryData(courseKeys.detail(course.id), updated);
      refreshCourse(course.id);
      toast.success("Estructura aprobada. La IA está escribiendo los guiones.");
      onApproved();
    },
    onError: toastError,
  });

  const regenerate = async () => {
    try {
      await propose(course.id, { ...initialBrief(course.language, course.settings), modules: null }, [], feedback);
      setFeedback("");
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        <OutlineDetails outline={draft} onChange={update} />

        <ol className="space-y-4" aria-label="Módulos propuestos">
          {draft.modules.map((module, index) => (
            <ModuleCard
              key={index}
              module={module}
              index={index}
              total={draft.modules.length}
              onChange={(next) => setModules(replaceAt(draft.modules, index, next))}
              onMove={(to) => setModules(moveItem(draft.modules, index, to))}
              onRemove={() => setModules(removeAt(draft.modules, index))}
            />
          ))}
        </ol>
        {draft.modules.length < MAX_MODULES && (
          <Button variant="outline" onClick={() => setModules([...draft.modules, blankModule()])}>
            <Plus /> Agregar módulo
          </Button>
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div className="border border-border bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-label text-ink-700">Resumen</p>
          <p className="mt-3 font-display text-4xl font-medium tracking-tightest">
            {plural(draft.modules.length, "módulo")}
          </p>
          <p className="text-sm text-muted-foreground">Unos {minutes} minutos en total</p>
          <Button
            variant="accent"
            className="mt-6 w-full"
            onClick={() => approve.mutate()}
            loading={approve.isPending}
            disabled={incomplete || Boolean(status)}
          >
            Aprobar y escribir guiones <ArrowRight />
          </Button>
          {incomplete && <p className="mt-3 text-xs text-warning">El curso y cada módulo necesitan un título.</p>}
        </div>
        <div className="border border-border bg-mist/60 p-6">
          <Label htmlFor="outline-feedback">¿Otra propuesta?</Label>
          <Textarea
            id="outline-feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Ej. menos teoría y más casos prácticos; agrega un módulo sobre primeros auxilios"
            maxLength={4000}
            className="min-h-[96px] bg-white"
            disabled={Boolean(status)}
          />
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={regenerate}
            loading={Boolean(status)}
            disabled={approve.isPending}
          >
            <RefreshCw /> Pedir otra propuesta
          </Button>
          {status && <p className="mt-2 text-xs text-muted-foreground">{status}…</p>}
        </div>
      </aside>
    </div>
  );
}
