"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, BookOpen, ChevronDown, HelpCircle, RotateCcw } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { studioApi } from "@/lib/api/studio";
import type { CourseDetail, Job, ModuleAdmin } from "@/lib/api/types";
import { plural, twoDigits } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { JobFailure, JobStatus } from "./job-status";
import { aiModules, isDrafting } from "./steps";
import { StoryboardEditor } from "./storyboard-editor";

function ModuleState({ module, job }: { module: ModuleAdmin; job?: Job }) {
  if (isDrafting(module) || job) {
    return <JobStatus job={job} fallback="En cola para escribir el guion" className="max-w-sm" />;
  }
  if (module.generation_status === "failed") {
    return <JobFailure message={module.generation_error || "No se pudo escribir el guion."} />;
  }
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span>{plural(module.scene_count, "escena")}</span>
      <span className="inline-flex items-center gap-1.5">
        <BookOpen className="h-3.5 w-3.5" /> {module.content_text ? "Lectura lista" : "Sin lectura"}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <HelpCircle className="h-3.5 w-3.5" />
        {module.evaluation ? plural(module.evaluation.question_count, "pregunta") : "Sin evaluación"}
      </span>
    </p>
  );
}

interface ContentStepProps {
  course: CourseDetail;
  jobs: Job[];
  onContinue: () => void;
}

/** Scripts, slides, reading and quiz of every AI module: review and edit before producing the videos. */
export function ContentStep({ course, jobs, onContinue }: ContentStepProps) {
  const confirm = useConfirm();
  const { refreshCourse } = useCourseCache();
  const [openId, setOpenId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);

  const draftJob = (moduleId: number) =>
    jobs.find((job) => job.module_id === moduleId && job.type === "ai.module_draft");
  // Per AI module: the job writing its script right now (if any) and whether the script is ready to review,
  // which is when it exists and nothing is rewriting it.
  const rows = aiModules(course).map((module) => {
    const job = draftJob(module.id);
    return { module, job, drafted: module.scene_count > 0 && !job };
  });
  const pending = rows.filter((row) => !row.drafted).length;
  const ready = pending === 0;

  const retry = useMutation({
    mutationFn: (moduleId: number) => studioApi.draft(course.id, [moduleId]),
    onSuccess: () => {
      refreshCourse(course.id);
    },
    onError: toastError,
  });

  const toggle = async (moduleId: number) => {
    if (dirty) {
      const discard = await confirm({
        title: "¿Descartar los cambios del guion?",
        confirmLabel: "Descartar",
        destructive: true,
      });
      if (!discard) return;
    }
    setDirty(false);
    setOpenId((current) => (current === moduleId ? null : moduleId));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display-md">Guiones y diapositivas</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {ready
              ? "Revisa lo que dirá la voz y cómo se verá cada diapositiva. Cada cambio se refleja al instante en la vista previa."
              : `La IA está escribiendo ${plural(pending, "módulo")}: guion, lectura y evaluación. Puedes revisar los que ya terminó.`}
          </p>
        </div>
        <Button variant="accent" onClick={onContinue} disabled={!ready || dirty}>
          Elegir voz y estilo <ArrowRight />
        </Button>
      </div>

      <ol className="space-y-3">
        {rows.map(({ module, job, drafted }) => {
          const expanded = openId === module.id && drafted;
          return (
            <li key={module.id} className="border border-border bg-white">
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="font-display text-2xl font-medium text-accent">{twoDigits(module.order)}</span>
                <div className="min-w-0 flex-1 basis-60 space-y-1.5">
                  <p className="font-semibold">{module.title}</p>
                  <ModuleState module={module} job={job} />
                </div>
                {module.generation_status === "failed" && !job ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retry.mutate(module.id)}
                    loading={retry.isPending && retry.variables === module.id}
                  >
                    <RotateCcw /> Reintentar
                  </Button>
                ) : drafted ? (
                  <Button variant="ghost" size="sm" onClick={() => toggle(module.id)} aria-expanded={expanded}>
                    {expanded ? "Cerrar" : "Revisar guion"}
                    <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
                  </Button>
                ) : (
                  <Badge variant="secondary" pulse>
                    Escribiendo
                  </Badge>
                )}
              </div>
              {expanded && (
                <div className="border-t border-border bg-mist/40 p-5">
                  <StoryboardEditor course={course} module={module} onDirtyChange={setDirty} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
