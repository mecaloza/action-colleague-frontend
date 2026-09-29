"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Eye, Play, RotateCcw, Sparkles } from "lucide-react";
import { ModuleVideo } from "@/components/courses/module-video";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { studioApi } from "@/lib/api/studio";
import type { CourseDetail, Job, ModuleAdmin } from "@/lib/api/types";
import { formatDuration, plural, twoDigits } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { useStableUrl } from "@/lib/hooks/use-stable-url";
import { toastError } from "@/lib/notify";
import { JobFailure, JobStatus } from "./job-status";
import { aiModules, isRendering } from "./steps";

function Thumbnail({ module, onPlay }: { module: ModuleAdmin; onPlay: () => void }) {
  const poster = useStableUrl(module.poster_url);
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Ver el video de ${module.title}`}
      className="group relative aspect-video w-40 shrink-0 overflow-hidden bg-ink-900"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
      <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/10">
        <Play className="h-6 w-6 fill-white text-white" />
      </span>
    </button>
  );
}

/** Shown once every video is produced: what to do next. */
function CourseReady({ courseId }: { courseId: number }) {
  return (
    <div className="band-dark flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
      <div className="relative z-10">
        <p className="eyebrow mb-3 flex items-center gap-2 text-white/60">
          <Sparkles className="h-4 w-4 text-accent" /> Listo
        </p>
        <h2 className="display-md text-white">Tu curso está producido.</h2>
        <p className="mt-2 text-white/70">Revisa cada módulo, ajusta la evaluación y publícalo para tu equipo.</p>
      </div>
      <div className="relative z-10 flex flex-wrap gap-3">
        <Button variant="outline-inverse" asChild>
          <Link href={`/admin/courses/${courseId}/preview`}>
            <Eye /> Vista previa
          </Link>
        </Button>
        <Button variant="accent" asChild>
          <Link href={`/admin/courses/${courseId}`}>
            Revisar y publicar <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

interface VideoStateProps {
  module: ModuleAdmin;
  job?: Job;
  rendering: boolean;
}

/** Where a module's video is: being produced, failed, ready or not started. */
function VideoState({ module, job, rendering }: VideoStateProps) {
  if (rendering) return <JobStatus job={job} fallback="En cola para producir" className="max-w-sm" />;
  if (module.generation_status === "failed") {
    return <JobFailure message={module.generation_error || "No se pudo producir el video."} />;
  }
  if (!module.video) return <p className="text-sm text-muted-foreground">Sin video todavía</p>;
  return (
    <p className="text-sm text-muted-foreground">
      Video de {formatDuration(module.duration_seconds)}
      {module.generation_error ? ` · ${module.generation_error}` : ""}
    </p>
  );
}

interface ProductionStepProps {
  course: CourseDetail;
  jobs: Job[];
}

/** Each module's video being produced, ready to watch, or failed with a retry. */
export function ProductionStep({ course, jobs }: ProductionStepProps) {
  const { refreshCourse } = useCourseCache();
  const [watching, setWatching] = useState<ModuleAdmin | null>(null);
  const renderJob = (moduleId: number) => jobs.find((job) => job.module_id === moduleId && job.type === "video.render");
  // Per AI module: the job producing its video right now (if any) and whether it is being produced.
  const rows = aiModules(course).map((module) => {
    const job = renderJob(module.id);
    return { module, job, rendering: isRendering(module) || Boolean(job) };
  });
  const done = rows.filter(({ module, rendering }) => module.video && !rendering).length;

  const retry = useMutation({
    mutationFn: (moduleId: number) => studioApi.renderModule(moduleId),
    onSuccess: () => {
      refreshCourse(course.id);
    },
    onError: toastError,
  });

  return (
    <div className="space-y-8">
      {done === rows.length ? (
        <CourseReady courseId={course.id} />
      ) : (
        <div>
          <h2 className="display-md">Produciendo los videos</h2>
          <p className="mt-2 text-muted-foreground">
            {done} de {plural(rows.length, "video")} listos. Puedes cerrar esta página: la producción sigue.
          </p>
        </div>
      )}

      <ol className="space-y-3">
        {rows.map(({ module, job, rendering }) => (
          <li key={module.id} className="flex flex-wrap items-center gap-4 border border-border bg-white px-5 py-4">
            <span className="font-display text-2xl font-medium text-accent">{twoDigits(module.order)}</span>
            {module.video && !rendering && <Thumbnail module={module} onPlay={() => setWatching(module)} />}
            <div className="min-w-0 flex-1 basis-60 space-y-1.5">
              <p className="font-semibold">{module.title}</p>
              <VideoState module={module} job={job} rendering={rendering} />
            </div>
            {!rendering && (module.generation_status === "failed" || !module.video) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => retry.mutate(module.id)}
                loading={retry.isPending && retry.variables === module.id}
              >
                <RotateCcw /> {module.video ? "Volver a producir" : "Producir"}
              </Button>
            )}
          </li>
        ))}
      </ol>

      <Dialog open={watching !== null} onOpenChange={(open) => !open && setWatching(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{watching?.title}</DialogTitle>
          </DialogHeader>
          {watching && <ModuleVideo module={watching} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
