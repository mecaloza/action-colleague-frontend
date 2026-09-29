"use client";

import { useEffect, useRef, useState } from "react";
import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { courseKeys } from "@/lib/api/courses";
import { studioApi, studioKeys } from "@/lib/api/studio";
import type { CourseDetail, CourseOutline, Job, OutlineModule } from "@/lib/api/types";
import { moveItem, removeAt, replaceAt } from "@/lib/array";
import { plural } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { isActiveJob, useJob } from "@/lib/hooks/use-jobs";
import { initialBrief } from "./brief-form";
import { JobFailure, JobStatus, ProposeStatus } from "./job-status";
import { ListEditor } from "./list-editor";
import { blankModule, ModuleCard } from "./outline-module-card";
import { LOCKED_MESSAGE, OUTLINE_JOB } from "./steps";
import { type ProposalRequest, useProposeOutline } from "./use-propose-outline";
import { useStudioCache } from "./use-studio-cache";

const MAX_MODULES = 12;

const endedBadly = (job: Job | null | undefined): job is Job =>
  Boolean(job && (job.status === "failed" || job.status === "canceled"));

/**
 * A heading that takes the focus when it replaces the "working" panel, which had it (or it would fall to the page).
 * Never while the admin has it somewhere else.
 */
function useTakeFocus(take: boolean) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (take && document.activeElement === document.body) heading.current?.focus();
  }, [take]);
  return heading;
}

interface OutlinePanelProps {
  title: string;
  /** It replaces the "working" panel: see `useTakeFocus`. */
  takeFocus?: boolean;
  children: React.ReactNode;
}

/** The step's frame when there's no proposal to edit: in progress, failed or not asked for yet. */
function OutlinePanel({ title, takeFocus = false, children }: OutlinePanelProps) {
  const heading = useTakeFocus(takeFocus);
  return (
    <div className="mx-auto max-w-2xl border border-border bg-white p-8">
      <p className="eyebrow mb-3">Estructura</p>
      <h2 ref={heading} tabIndex={-1} className="display-md mb-6 focus-visible:ring-0">
        {title}
      </h2>
      {children}
    </div>
  );
}

interface OutlineStepProps {
  course: CourseDetail;
  /** The proposal saved on the course (null before the first one). */
  outline: UseQueryResult<CourseOutline | null>;
  /** The outline job in progress, if the AI is writing a proposal. */
  activeJob: Job | null;
  /** The proposal asked for in this visit, if any: followed until it ends, to show why it failed. */
  asked: ProposalRequest | null;
  /** The course has content: no other proposal can replace it. */
  locked: boolean;
  /** Another proposal was asked for (its job is the AI writing it). */
  onProposed: (request: ProposalRequest) => void;
  onBrief: () => void;
  onApproved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

/** The AI's proposal: edit it, ask for another one with instructions, or approve it. */
export function OutlineStep({
  course,
  outline,
  activeJob,
  asked,
  locked,
  onProposed,
  onBrief,
  onApproved,
  onDirtyChange,
}: OutlineStepProps) {
  const proposal = outline.data ?? null;
  // The last proposal asked for: the one seen running here (also when asked for elsewhere: the new-course page,
  // another tab), the one asked for in this visit, or else (with no proposal to show) the course's newest.
  const [seenJobId, setSeenJobId] = useState<string | null>(null);
  if (activeJob && activeJob.id !== seenJobId) setSeenJobId(activeJob.id);
  const knownJobId = seenJobId ?? asked?.job.id ?? null;
  const latest = useQuery({
    queryKey: studioKeys.latestJob(course.id, OUTLINE_JOB),
    queryFn: () => studioApi.latestJob(course.id, OUTLINE_JOB),
    enabled: !knownJobId && !activeJob && !proposal,
  });
  // Followed until it ends: whether the AI is still at it, or why it failed. While its polling fails, the last
  // state it got may be stale: "still running" isn't trusted then (the error shows, with a retry).
  const followed = useJob(knownJobId ?? (proposal ? null : (latest.data?.id ?? null)));
  const last = followed.data ?? null;
  const running = Boolean(last && isActiveJob(last) && !followed.isError);
  // What the admin asked, when that's the job that failed: to ask again for the same.
  const request = asked && last && asked.job.id === last.id ? asked : null;
  // Whatever replaces the "working" panel takes the focus it had.
  const [wasWorking, setWasWorking] = useState(false);

  if (activeJob || running) {
    if (!wasWorking) setWasWorking(true);
    return (
      <OutlinePanel title="La IA está armando tu curso">
        <JobStatus job={activeJob ?? last} fallback="Proponiendo módulos y objetivos" />
        <p className="mt-6 text-sm text-muted-foreground">
          Suele tardar menos de un minuto. Puedes salir: el curso queda guardado.
        </p>
      </OutlinePanel>
    );
  }
  if (proposal) {
    const failure = endedBadly(last) ? last : null;
    // Keyed by the proposal: a new one (regenerated) starts a fresh draft.
    return (
      <OutlineEditor
        key={JSON.stringify(proposal)}
        course={course}
        outline={proposal}
        locked={locked}
        failure={failure}
        initialFeedback={failure && request ? request.feedback : ""}
        takeFocus={wasWorking}
        onProposed={onProposed}
        onApproved={onApproved}
        onDirtyChange={onDirtyChange}
      />
    );
  }
  if (outline.isError) {
    return (
      <OutlinePanel title="La propuesta de estructura" takeFocus={wasWorking}>
        <QueryError query={outline} />
      </OutlinePanel>
    );
  }
  if (last?.status === "succeeded") {
    // Only its proposal is missing: the course's refresh is bringing it.
    return (
      <OutlinePanel title="La IA está armando tu curso">
        <JobStatus job={last} fallback="Guardando la propuesta" />
      </OutlinePanel>
    );
  }
  if (endedBadly(last)) {
    return (
      <OutlineFailed
        course={course}
        job={last}
        request={request}
        locked={locked}
        takeFocus={wasWorking}
        onProposed={onProposed}
        onBrief={onBrief}
      />
    );
  }
  const loadFailed = followed.isError ? followed : latest.isError ? latest : null;
  if (loadFailed) {
    return (
      <OutlinePanel title="La propuesta de estructura" takeFocus={wasWorking}>
        <QueryError query={loadFailed} />
      </OutlinePanel>
    );
  }
  if (latest.isLoading || followed.isLoading) return <Skeleton className="mx-auto h-64 max-w-2xl" />;
  return (
    <OutlinePanel title="Aún no hay una estructura" takeFocus={wasWorking}>
      <p className="text-muted-foreground">
        {locked
          ? "Este curso no tiene una propuesta de la IA: sus módulos se editan en el paso Contenido o en el editor."
          : "Cuenta en el brief qué curso necesitas y la IA propondrá sus módulos y objetivos."}
      </p>
      <Button variant="accent" className="mt-6" onClick={onBrief}>
        Ir al brief <ArrowRight />
      </Button>
    </OutlinePanel>
  );
}

interface OutlineFailedProps {
  course: CourseDetail;
  job: Job;
  /** What was asked for the job that failed, when this visit asked it. */
  request: ProposalRequest | null;
  locked: boolean;
  takeFocus: boolean;
  onProposed: (request: ProposalRequest) => void;
  onBrief: () => void;
}

/** The last proposal failed (or was canceled) and there is none to edit: why, and the way to ask again. */
function OutlineFailed({ course, job, request, locked, takeFocus, onProposed, onBrief }: OutlineFailedProps) {
  const { proposeFromStep, status } = useProposeOutline();

  // The same request again (or, if it was asked elsewhere, the brief saved with the course).
  const retry = async () => {
    const values = request?.values ?? initialBrief(course.language, course.settings);
    const next = await proposeFromStep(course.id, values, request?.feedback);
    if (next) onProposed(next);
  };

  return (
    <OutlinePanel title="No se pudo proponer la estructura" takeFocus={takeFocus}>
      <div role="alert">
        <JobFailure
          message={job.error || (job.status === "canceled" ? "La propuesta se canceló." : "La IA no pudo proponerla.")}
        />
      </div>
      {status ? (
        <div className="mt-6">
          <ProposeStatus status={status} />
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={onBrief}>
            <ArrowLeft /> Volver al brief
          </Button>
          <Button variant="accent" onClick={retry} disabled={locked}>
            <RotateCcw /> Reintentar
          </Button>
        </div>
      )}
    </OutlinePanel>
  );
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
  locked: boolean;
  /** The last proposal asked for in this visit failed: the one on screen is still the previous one. */
  failure: Job | null;
  /** The instructions of that failed request, to send them again. */
  initialFeedback: string;
  /** It replaces the "working" panel: see `useTakeFocus`. */
  takeFocus: boolean;
  onProposed: (request: ProposalRequest) => void;
  onApproved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function OutlineEditor({
  course,
  outline,
  locked,
  failure,
  initialFeedback,
  takeFocus,
  onProposed,
  onApproved,
  onDirtyChange,
}: OutlineEditorProps) {
  const queryClient = useQueryClient();
  const heading = useTakeFocus(takeFocus);
  const { refreshCourse } = useCourseCache();
  const { trackJobs, failed } = useStudioCache();
  const [draft, setDraft] = useState(outline);
  const [feedback, setFeedback] = useState(initialFeedback);
  const { proposeFromStep, status } = useProposeOutline();
  const update = (changes: Partial<CourseOutline>) => setDraft((current) => ({ ...current, ...changes }));
  const setModules = (modules: OutlineModule[]) => update({ modules });
  const minutes = draft.modules.reduce((total, module) => total + module.estimated_minutes, 0);
  const incomplete = !draft.title.trim() || draft.modules.some((module) => !module.title.trim());
  // Edits to the proposal: leaving the step (or the page) asks first.
  const dirty = JSON.stringify(draft) !== JSON.stringify(outline);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const approve = useMutation({
    mutationFn: async () => {
      const updated = await studioApi.applyOutline(course.id, withoutBlanks(draft));
      const queued = await studioApi.draft(course.id); // scripts, reading and quiz of every module, in the background
      return { updated, queued };
    },
    onSuccess: ({ updated, queued }) => {
      // The content step needs the new modules at once; the refetch adds the drafting that just started.
      queryClient.setQueryData(courseKeys.detail(course.id), updated);
      trackJobs(course.id, queued);
      void refreshCourse(course.id);
      toast.success("Estructura aprobada. La IA está escribiendo los guiones.");
      onApproved();
    },
    onError: (error) => {
      failed(course.id)(error);
      void refreshCourse(course.id); // the modules may exist already: only asking for their scripts failed
    },
  });

  const regenerate = async () => {
    const request = await proposeFromStep(course.id, initialBrief(course.language, course.settings), feedback);
    if (!request) return;
    setFeedback("");
    onProposed(request);
  };

  return (
    <>
      <h2 ref={heading} tabIndex={-1} className="sr-only">
        Estructura propuesta
      </h2>
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <fieldset disabled={locked || Boolean(status)} className="min-w-0 space-y-8">
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
        </fieldset>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {failure && (
            <div role="alert" className="border-l-2 border-destructive bg-red-50 px-4 py-3">
              <JobFailure
                message={`No se pudo generar otra propuesta: ${
                  failure.error || (failure.status === "canceled" ? "se canceló." : "la IA no respondió.")
                }`}
              />
            </div>
          )}
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
              disabled={locked || incomplete || Boolean(status)}
            >
              Aprobar y escribir guiones <ArrowRight />
            </Button>
            {locked ? (
              <p className="mt-3 text-xs text-muted-foreground">{LOCKED_MESSAGE}</p>
            ) : (
              incomplete && <p className="mt-3 text-xs text-warning">El curso y cada módulo necesitan un título.</p>
            )}
            {dirty && !status && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setDraft(outline)}
                disabled={approve.isPending}
              >
                Descartar cambios
              </Button>
            )}
          </div>
          {!locked && (
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
                disabled={approve.isPending || dirty}
                aria-describedby={dirty ? "outline-feedback-hint" : undefined}
              >
                <RefreshCw /> Pedir otra propuesta
              </Button>
              {status && <p className="mt-2 text-xs text-muted-foreground">{status}…</p>}
              {dirty && !status && (
                <p id="outline-feedback-hint" className="mt-2 text-xs text-muted-foreground">
                  Descarta tus cambios para pedir otra: la IA parte de la propuesta guardada.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
