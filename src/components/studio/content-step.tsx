"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, BookOpen, ChevronDown, HelpCircle, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { studioApi } from "@/lib/api/studio";
import type { CourseDetail, Job, ModuleAdmin } from "@/lib/api/types";
import { plural, twoDigits } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { cn } from "@/lib/utils";
import { JobFailure, JobStatus } from "./job-status";
import { aiModules, type ModuleActivity, moduleActivity, moduleJob } from "./steps";
import { StoryboardEditor } from "./storyboard-editor";
import { useStudioCache } from "./use-studio-cache";

function ModuleState({ module, activity, job }: { module: ModuleAdmin; activity: ModuleActivity; job?: Job }) {
  if (activity === "drafting") {
    return <JobStatus job={job} fallback="En cola para escribir el guion" className="max-w-sm" />;
  }
  if (module.generation_status === "failed" && !module.scene_count) {
    return <JobFailure message={module.generation_error || "No se pudo escribir el guion."} />;
  }
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{module.scene_count ? plural(module.scene_count, "escena") : "Sin guion"}</span>
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" /> {module.content_text ? "Lectura lista" : "Sin lectura"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          {module.evaluation ? plural(module.evaluation.question_count, "pregunta") : "Sin evaluación"}
        </span>
        {activity === "rendering" && (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Produciendo el video
          </span>
        )}
      </p>
      {/* The script is there: what failed was its video or a rewrite, and the script can still be reviewed. */}
      {module.generation_status === "failed" && (
        <JobFailure
          message={
            module.generation_error
              ? `La última operación falló. ${module.generation_error}`
              : "La última operación falló."
          }
        />
      )}
    </>
  );
}

interface ContentStepProps {
  course: CourseDetail;
  jobs: Job[];
  /** A script has edits not saved yet (the page asks before leaving the step). */
  dirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onContinue: () => void;
}

/** Scripts, slides, reading and quiz of every AI module: review and edit before producing the videos. */
export function ContentStep({ course, jobs, dirty, onDirtyChange, onContinue }: ContentStepProps) {
  const confirm = useConfirm();
  const { refreshCourse } = useCourseCache();
  const { trackJobs, failed } = useStudioCache();
  const [openId, setOpenId] = useState<number | null>(null);

  // Per AI module: what it is doing (writing its script, producing its video), the job doing it, and whether its
  // script is ready to review (it has one and nothing is rewriting it).
  const rows = aiModules(course).map((module) => {
    const activity = moduleActivity(module, jobs);
    const drafted = module.scene_count > 0 && activity !== "drafting";
    return { module, activity, job: moduleJob(module, jobs), drafted };
  });
  // Only what the AI is writing right now: a module without a script and without a job waits for the admin.
  const pending = rows.filter((row) => row.activity === "drafting").length;
  const ready = pending === 0 && rows.some((row) => row.drafted);

  const write = useMutation({
    mutationFn: (moduleId: number) => studioApi.draft(course.id, [moduleId]),
    onSuccess: (queued) => {
      trackJobs(course.id, queued);
      void refreshCourse(course.id);
    },
    onError: failed(course.id),
  });

  /** Asks the AI for the module's script (again, after a failure); first asks when that replaces its reading. */
  const writeScript = async (module: ModuleAdmin) => {
    const reading = Boolean(module.content_text.trim());
    if (reading || module.video) {
      const confirmed = await confirm({
        title: "¿Escribir el guion con IA?",
        description:
          `La IA escribirá el guion de «${module.title}»${reading ? " y reemplazará su lectura" : ""}.` +
          (module.video ? " El video actual se mantiene hasta que produzcas uno nuevo." : ""),
        confirmLabel: "Escribir guion",
      });
      if (!confirmed) return;
    }
    write.mutate(module.id);
  };

  const toggle = async (moduleId: number) => {
    if (dirty) {
      const discard = await confirm({
        title: "¿Descartar los cambios del guion?",
        confirmLabel: "Descartar",
        destructive: true,
      });
      if (!discard) return;
    }
    onDirtyChange(false);
    setOpenId((current) => (current === moduleId ? null : moduleId));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 tabIndex={-1} className="display-md focus-visible:ring-0">
            Guiones y diapositivas
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {pending
              ? `La IA está escribiendo ${plural(pending, "módulo")}: guion, lectura y evaluación. Puedes revisar los que ya terminó.`
              : ready
                ? "Revisa lo que dirá la voz y cómo se verá cada diapositiva. Cada cambio se refleja al instante en la vista previa."
                : "Ningún módulo tiene guion todavía. Pídeselo a la IA para poder producir sus videos."}
          </p>
        </div>
        <Button variant="accent" onClick={onContinue} disabled={!ready}>
          Elegir voz y estilo <ArrowRight />
        </Button>
      </div>

      <ol className="space-y-3">
        {rows.map(({ module, activity, job, drafted }) => {
          const expanded = openId === module.id && drafted;
          const writing = write.isPending && write.variables === module.id;
          return (
            <li key={module.id} className="border border-border bg-white">
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="font-display text-2xl font-medium text-accent">{twoDigits(module.order)}</span>
                <div className="min-w-0 flex-1 basis-60 space-y-1.5">
                  <p className="font-semibold">{module.title}</p>
                  <ModuleState module={module} activity={activity} job={job} />
                </div>
                {activity === "drafting" ? (
                  <Badge variant="secondary" pulse>
                    Escribiendo
                  </Badge>
                ) : drafted ? (
                  <Button variant="ghost" size="sm" onClick={() => toggle(module.id)} aria-expanded={expanded}>
                    {expanded ? "Cerrar" : "Revisar guion"}
                    <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
                  </Button>
                ) : module.generation_status === "failed" ? (
                  <Button variant="outline" size="sm" onClick={() => writeScript(module)} loading={writing}>
                    <RotateCcw /> Reintentar
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => writeScript(module)} loading={writing}>
                    <Sparkles /> Escribir guion con IA
                  </Button>
                )}
              </div>
              {expanded && (
                <div className="border-t border-border bg-mist/40 p-5">
                  <StoryboardEditor
                    course={course}
                    module={module}
                    rendering={activity === "rendering"}
                    dirty={dirty}
                    onDirtyChange={onDirtyChange}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
