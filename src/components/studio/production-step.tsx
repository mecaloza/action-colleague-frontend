"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Eye, Play, RotateCcw, Sparkles } from "lucide-react";
import { ModuleVideo } from "@/components/courses/module-video";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STUDIO_STALE_MS, studioApi, studioKeys } from "@/lib/api/studio";
import type { CourseDetail, Job, ModuleAdmin } from "@/lib/api/types";
import { formatDuration, plural, twoDigits } from "@/lib/format";
import { useStableUrl } from "@/lib/hooks/use-stable-url";
import { cn } from "@/lib/utils";
import { JobFailure, JobStatus } from "./job-status";
import { isError, summaryLines } from "./layout-warnings";
import { inRenderSlot } from "./render-slots";
import { aiModules, type ModuleActivity, moduleActivity, moduleJob } from "./steps";
import { useProduceModule } from "./use-produce-module";

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
        <h2 tabIndex={-1} className="display-md text-white focus-visible:ring-0">
          Tu curso está producido.
        </h2>
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
  activity: ModuleActivity;
  job?: Job;
}

/** Where a module's video is: being produced, waiting for its script, failed, ready or not started. */
function VideoState({ module, activity, job }: VideoStateProps) {
  if (activity) {
    // Producing its video, or (re)writing its script: the video can be produced once that's done.
    const fallback = activity === "rendering" ? "En cola para producir" : "En cola para escribir el guion";
    return <JobStatus job={job} fallback={fallback} className="max-w-sm" />;
  }
  if (module.generation_status === "failed" && !module.video) {
    return <JobFailure message={module.generation_error || "No se pudo producir el video."} />;
  }
  if (!module.video) {
    return (
      <p className="text-sm text-muted-foreground">
        {module.scene_count ? "Sin video todavía" : "Sin guion: escríbelo en el paso Contenido para producir su video."}
      </p>
    );
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">Video de {formatDuration(module.duration_seconds)}</p>
      {module.generation_status === "failed" && (
        <p className="text-sm text-muted-foreground">
          La última operación falló{module.generation_error ? `. ${module.generation_error}` : "."} El video anterior sigue
          publicado.
        </p>
      )}
      {module.video_warning && (
        <p className="flex items-start gap-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {module.video_warning}
        </p>
      )}
    </>
  );
}

/** What doesn't fit or overlaps on the slides of the module's saved script, scene by scene, and a way to fix it. */
function ScriptWarnings({ module, onFix }: { module: ModuleAdmin; onFix: () => void }) {
  const [open, setOpen] = useState(false);
  const storyboard = useQuery({
    queryKey: studioKeys.storyboard(module.id),
    // Every module asks at once, and the server draws each script's slides: two at a time, like the previews.
    queryFn: ({ signal }) => inRenderSlot(signal, () => studioApi.storyboard(module.id, signal)),
    // The script editor's own copy (same key): dropped when this step closes, so the editor never opens it stale.
    gcTime: 0,
    staleTime: STUDIO_STALE_MS,
  });
  const data = storyboard.data;
  // Not knowing isn't "no warnings": the admin could produce the video again over a text that is cut.
  if (!data && storyboard.isError) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        No se pudieron revisar los avisos de diseño.
        <Button
          variant="link"
          className="text-[13px]"
          onClick={() => void storyboard.refetch()}
          aria-label={`Reintentar: avisos de diseño de ${module.title}`}
        >
          Reintentar
        </Button>
      </p>
    );
  }
  if (!data?.warnings?.length) return null;
  const { warnings } = data;
  const numbers = new Map(data.scenes.map((scene, index) => [scene.id, index + 1]));
  const listId = `studio-module-${module.id}-warnings`;
  return (
    <div className="space-y-1">
      <p
        className={cn(
          "flex items-start gap-2 text-sm",
          warnings.some(isError) ? "text-destructive" : "text-warning",
        )}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Avisos de diseño: {summaryLines(warnings).join(" · ")}.</span>
      </p>
      <div className="flex flex-wrap items-center gap-x-4 pl-6">
        <Button
          variant="link"
          className="text-[13px]"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen((shown) => !shown)}
        >
          {open ? "Ocultar avisos" : "Ver avisos"}
        </Button>
        <Button variant="link" className="text-[13px]" onClick={onFix}>
          Corregir en el guion <ArrowRight />
        </Button>
      </div>
      {open && (
        <ul id={listId} className="space-y-1 pl-6 text-sm">
          {warnings.map((warning) => (
            <li key={`${warning.scene_id}:${warning.code}:${warning.field}`}>
              <span className="font-semibold">Escena {twoDigits(numbers.get(warning.scene_id) ?? 0)}:</span>{" "}
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ProductionStepProps {
  course: CourseDetail;
  jobs: Job[];
  /** Opens the module's script in the Contenido step, to fix what its slides warn about. */
  onFixScript: (moduleId: number) => void;
}

/** Each module's video being produced, ready to watch (and to produce again), or failed with a retry. */
export function ProductionStep({ course, jobs, onFixScript }: ProductionStepProps) {
  const [watching, setWatching] = useState<ModuleAdmin | null>(null);
  const { produce, producingId } = useProduceModule(course);
  // Per AI module: what it is doing (producing its video, or writing its script) and the job doing it.
  const rows = aiModules(course).map((module) => ({
    module,
    activity: moduleActivity(module, jobs),
    job: moduleJob(module, jobs),
  }));
  const done = rows.filter(({ module, activity }) => module.video && activity !== "rendering").length;
  const producing = rows.some(({ activity }) => activity === "rendering");

  return (
    <div className="space-y-8">
      {done === rows.length ? (
        <CourseReady courseId={course.id} />
      ) : (
        <div>
          <h2 tabIndex={-1} className="display-md focus-visible:ring-0">
            {producing ? "Produciendo los videos" : "Los videos del curso"}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {done} de {plural(rows.length, "video")} listos.
            {producing && " Puedes cerrar esta página: la producción sigue."}
          </p>
        </div>
      )}

      <ol className="space-y-3">
        {rows.map(({ module, activity, job }) => (
          <li key={module.id} className="flex flex-wrap items-center gap-4 border border-border bg-white px-5 py-4">
            <span className="font-display text-2xl font-medium text-accent">{twoDigits(module.order)}</span>
            {module.video && activity !== "rendering" && <Thumbnail module={module} onPlay={() => setWatching(module)} />}
            <div className="min-w-0 flex-1 basis-60 space-y-1.5">
              <p className="font-semibold">{module.title}</p>
              <VideoState module={module} activity={activity} job={job} />
              {/* Its saved script's slides (one being rewritten has no warnings to show yet). */}
              {module.scene_count > 0 && activity !== "drafting" && (
                <ScriptWarnings module={module} onFix={() => onFixScript(module.id)} />
              )}
            </div>
            {/* Any module with a script can be produced (again, e.g. after editing it) unless it's being produced;
                while its script is being written the button waits. */}
            {module.scene_count > 0 && activity !== "rendering" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => produce(module)}
                loading={producingId === module.id}
                disabled={activity === "drafting"}
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
