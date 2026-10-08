"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, Info, RotateCcw, Sparkles } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { revisionKeys, revisionsApi } from "@/lib/api/revisions";
import { STUDIO_STALE_MS, studioApi, studioKeys } from "@/lib/api/studio";
import type {
  CourseDetail,
  ModuleAdmin,
  Revision,
  RevisionConflict,
  RevisionStatus,
  StoryboardOut,
} from "@/lib/api/types";
import { plural, twoDigits } from "@/lib/format";
import { useJob } from "@/lib/hooks/use-jobs";
import { matchesMedia, TOUCH_ONLY } from "@/lib/hooks/use-media-query";
import { useOpening } from "@/lib/hooks/use-opening";
import { useStudioCapabilities } from "@/lib/hooks/use-studio-capabilities";
import { toastError } from "@/lib/notify";
import { toggled } from "@/lib/utils";
import { ChoiceButton } from "./choice-button";
import { JobStatus } from "./job-status";
import { inRenderSlot } from "./render-slots";
import { IgnoredChanges, RevisionDiff, RevisionImpactPanel, sceneTitle } from "./revision-diff";
import { isPendingRevision, RevisionHistory } from "./revision-history";
import { isBusy } from "./steps";
import { useRevisionCache } from "./use-revision-cache";
import { useStudioCache } from "./use-studio-cache";

/** A proposal being prepared is followed this often. */
const PROPOSING_POLL_MS = 2000;

/** Observations to start from: a tap adds one to the text. */
const EXAMPLES = [
  "El título no se entiende: que diga exactamente qué se revisa.",
  "Acorta la narración y nombra los puntos en el orden en que aparecen.",
  "Agrega un ejemplo concreto del trabajo diario.",
  "La infografía se ve mal: haz otra versión.",
];

const UNSAVED_APPLY = "Guarda o descarta los cambios del guion en el editor: aplicar la propuesta los reemplazaría.";
const UNSAVED_UNDO = "Guarda o descarta los cambios del guion en el editor: deshacer un cambio los reemplazaría.";

export type RevisionTab = "change" | "history";

/** What the sheet opens on. */
export interface RevisionRequest {
  moduleId: number;
  /** The scenes a new change starts scoped to (a scene's own button). */
  sceneIds?: string[];
  /** The history instead of a change. */
  tab?: RevisionTab;
}

/** Open state of a `RevisionSheet`: `show` opens it on a module, each time afresh. */
export function useRevisionSheet() {
  const opening = useOpening<RevisionRequest | null>(null);
  return {
    show: (request: RevisionRequest) => opening.show(request),
    /** The module it is (or was last) open on. */
    moduleId: opening.value?.moduleId ?? null,
    /** Its props. */
    sheet: { request: opening.value, open: opening.open, openingKey: opening.key, onClose: opening.hide },
  };
}

/** "Escena 02", "Escenas 02 y 05" or "Todo el guion": a change's scenes, numbered as the script has them now. */
function scopeLabel(sceneIds: string[], numbers: Map<string, number>): string {
  if (!sceneIds.length) return "Todo el guion";
  const listed = sceneIds
    .map((id) => numbers.get(id))
    .filter((number): number is number => number !== undefined)
    .sort((a, b) => a - b)
    .map(twoDigits);
  if (!listed.length) return plural(sceneIds.length, "escena");
  if (listed.length === 1) return `Escena ${listed[0]}`;
  return `Escenas ${listed.slice(0, -1).join(", ")} y ${listed[listed.length - 1]}`;
}

/** The 409 of a change whose scenes (or reading) changed since it was made: where, to say it and ask again. */
function conflictOf(error: unknown): RevisionConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const detail = error.detail as Partial<RevisionConflict> | null | undefined;
  return detail && typeof detail === "object" && typeof detail.code === "string" && typeof detail.message === "string"
    ? (detail as RevisionConflict)
    : null;
}

/** Focuses the element as it appears when `enabled` (a view the admin moved to, or a result that just arrived). */
function useFocusOnMount<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only as it appears
  }, []);
  return ref;
}

/** A new observation: where it starts from (asked again, another adjustment...). */
interface ComposeState {
  observation: string;
  sceneIds: string[];
  /** The proposal it replaces ("Pedir otro ajuste"): the admin can go back to it. */
  replacing: Revision | null;
}

/** What the change tab shows: the form for an observation, or a change (being prepared, to review, failed...). */
type ViewTarget = ({ kind: "compose" } & ComposeState) | { kind: "revision"; id: number };

/** `serial`: each view starts afresh; `focus`: the admin moved to it (its heading or field takes the focus). */
type View = ViewTarget & { serial: number; focus: boolean };

interface RevisionSheetProps {
  course: CourseDetail;
  request: RevisionRequest | null;
  open: boolean;
  /** Each opening starts afresh. */
  openingKey: number;
  onClose: () => void;
  /** The module's script has edits not saved in the editor: applying or undoing would replace them. */
  unsaved?: boolean;
}

/**
 * "Pedir un cambio": an observation about the module's script (all of it or some scenes) -> the AI's proposal, shown
 * as a diff with what producing the video again takes -> applied (maybe with the video), asked again or discarded.
 * Its history lists every change to the script, applied ones with «Deshacer».
 */
export function RevisionSheet({ course, request, open, openingKey, onClose, unsaved = false }: RevisionSheetProps) {
  const revised = course.modules.find((each) => each.id === request?.moduleId) ?? null;
  return (
    <Sheet open={open && revised !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl">
        {revised && request && (
          <RevisionPanel
            key={openingKey}
            course={course}
            module={revised}
            request={request}
            unsaved={unsaved}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

interface PanelProps {
  course: CourseDetail;
  module: ModuleAdmin;
  request: RevisionRequest;
  unsaved: boolean;
  onClose: () => void;
}

function RevisionPanel({ course, module, request, unsaved, onClose }: PanelProps) {
  const cache = useRevisionCache();
  const unsavedId = useId();
  const [tab, setTab] = useState<RevisionTab>(request.tab ?? "change");
  const history = useQuery({
    queryKey: revisionKeys.list(module.id),
    queryFn: () => revisionsApi.list(module.id, "script"),
    refetchOnMount: "always", // what waits for review may have changed elsewhere (another tab, another admin)
  });
  const storyboard = useQuery({
    queryKey: studioKeys.storyboard(module.id),
    // The server draws the slides to check them: two at a time, like the previews.
    queryFn: ({ signal }) => inRenderSlot(signal, () => studioApi.storyboard(module.id, signal)),
    gcTime: 0, // the script editor's own copy (same key): dropped as it closes, so it never opens stale
    staleTime: STUDIO_STALE_MS,
  });
  const numbers = new Map((storyboard.data?.scenes ?? []).map((scene, index) => [scene.id, index + 1]));

  const [view, setView] = useState<View | null>(null);
  const go = (next: ViewTarget) => {
    setTab("change");
    setView((current) => ({ ...next, serial: (current?.serial ?? 0) + 1, focus: true }));
  };
  const compose = (from: Partial<ComposeState> = {}) =>
    go({ kind: "compose", observation: "", sceneIds: request.sceneIds ?? [], replacing: null, ...from });
  // As it opens (from the server's answer, not a copy kept from before): a proposal still waiting is shown first
  // (asking for another replaces it); otherwise the form.
  if (view === null && !history.isPending && !history.isFetching) {
    const pending = history.data?.find(isPendingRevision);
    setView(
      pending
        ? { kind: "revision", id: pending.id, serial: 0, focus: false }
        : { kind: "compose", observation: "", sceneIds: request.sceneIds ?? [], replacing: null, serial: 0, focus: false },
    );
  }

  const shared = { course, module, storyboard, numbers };
  return (
    <>
      <SheetHeader className="border-b-0 pb-3">
        <p className="eyebrow mb-2">Módulo {twoDigits(module.order)}</p>
        <SheetTitle className="font-display text-2xl font-medium tracking-tightest">Cambios al guion</SheetTitle>
        <SheetDescription className="mt-1 break-words text-sm text-muted-foreground">{module.title}</SheetDescription>
      </SheetHeader>
      <Tabs value={tab} onValueChange={(value) => setTab(value as RevisionTab)} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 px-6">
          <TabsTrigger value="change">Pedir un cambio</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        {/* Kept while the history is shown: what is being written (or prepared) is still there on coming back. An
            inactive panel is only `hidden`, which its `flex` would override: hidden by its state instead. */}
        <TabsContent value="change" forceMount className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          {view === null ? (
            <SheetBody>
              <Skeleton className="h-64" />
            </SheetBody>
          ) : view.kind === "compose" ? (
            <ComposeView
              key={view.serial}
              {...shared}
              start={view}
              focus={view.focus}
              onProposed={(revision) => go({ kind: "revision", id: revision.id })}
              onBack={view.replacing ? () => go({ kind: "revision", id: view.replacing!.id }) : undefined}
            />
          ) : (
            <RevisionView
              key={view.serial}
              {...shared}
              id={view.id}
              focus={view.focus}
              unsaved={unsaved}
              onClose={onClose}
              onAnother={(revision) =>
                compose({
                  sceneIds: request.sceneIds?.length ? request.sceneIds : revision.scope.scene_ids,
                  replacing: revision,
                })
              }
              onAskAgain={(revision, replacing) =>
                compose({
                  observation: revision.observation,
                  sceneIds: revision.scope.scene_ids,
                  replacing: replacing ? revision : null,
                })
              }
              onCompose={() => compose()}
            />
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <SheetBody className="space-y-4">
            {unsaved && (
              <p id={unsavedId} className="border-l-2 border-warning bg-amber-50 px-4 py-3 text-sm">
                {UNSAVED_UNDO}
              </p>
            )}
            <RevisionHistory
              moduleId={module.id}
              blockedBy={unsaved ? unsavedId : undefined}
              onUndo={(revisionId) => cache.undo(course.id, module.id, revisionId)}
              onShow={(revisionId) => go({ kind: "revision", id: revisionId })}
            />
          </SheetBody>
        </TabsContent>
      </Tabs>
    </>
  );
}

interface SharedProps {
  course: CourseDetail;
  module: ModuleAdmin;
  /** The module's saved script: its scenes to choose from, and their numbers. */
  storyboard: UseQueryResult<StoryboardOut>;
  numbers: Map<string, number>;
}

/** What was asked for: the observation and its scenes. */
function Asked({ revision, numbers }: { revision: Revision; numbers: Map<string, number> }) {
  return (
    <p className="break-words text-sm text-muted-foreground">
      Pediste: «{revision.observation}» · {scopeLabel(revision.scope.scene_ids, numbers)}
    </p>
  );
}

interface ComposeViewProps extends SharedProps {
  start: ComposeState;
  focus: boolean;
  onProposed: (revision: Revision) => void;
  /** Back to the proposal the new one would replace. */
  onBack?: () => void;
}

/** The observation (with examples to start from) and the scenes it is about: the AI proposes, nothing is applied. */
function ComposeView({ course, module, storyboard, numbers, start, focus, onProposed, onBack }: ComposeViewProps) {
  const formId = useId();
  const fieldId = useId();
  const examplesId = useId();
  const queryClient = useQueryClient();
  const cache = useRevisionCache();
  const { trackJobs, failed } = useStudioCache();
  const capabilities = useStudioCapabilities();
  const [observation, setObservation] = useState(start.observation);
  const [chosen, setChosen] = useState(start.sceneIds);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // On a touch screen the keyboard would pop up over the panel: there the admin taps the field.
  useEffect(() => {
    if (focus && !matchesMedia(TOUCH_ONLY)) field.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only as the form appears
  }, []);
  const scenes = storyboard.data?.scenes ?? [];
  // A chosen scene no longer in the script (removed meanwhile) isn't asked for.
  const scope = storyboard.data ? chosen.filter((id) => numbers.has(id)) : chosen;

  const propose = useMutation({
    mutationFn: () =>
      revisionsApi.propose(module.id, {
        target: "script",
        observation: observation.trim(),
        scene_ids: scope.length ? scope : null,
      }),
    onSuccess: ({ revision, job }) => {
      queryClient.setQueryData(revisionKeys.detail(revision.id), revision);
      queryClient.setQueryData(studioKeys.job(job.id), job);
      trackJobs(course.id, [job]);
      void cache.refreshChanges(course.id, module.id);
      onProposed(revision);
    },
    onError: (problem) => {
      failed(course.id)(problem);
      void cache.refreshChanges(course.id, module.id);
      // A chosen scene is gone from the script (edited elsewhere): its list is loaded again.
      if (problem instanceof ApiError && problem.status === 422) void storyboard.refetch();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!observation.trim()) {
      flushSync(() => setError("Escribe qué quieres cambiar."));
      field.current?.focus();
      return;
    }
    propose.mutate();
  };

  const addExample = (example: string) => {
    setObservation((current) => (current.trim() ? `${current.trimEnd()}\n${example}` : example));
    setError(null);
    if (!matchesMedia(TOUCH_ONLY)) field.current?.focus();
  };

  return (
    <>
      <SheetBody className="space-y-6">
        {start.replacing && (
          <p className="border-l-2 border-border bg-mist px-4 py-3 text-sm">
            La propuesta anterior («{start.replacing.observation}») se reemplaza por la que pidas ahora.
          </p>
        )}
        {!capabilities.ai && (
          <Alert variant="warning">
            <Sparkles />
            <div>
              <AlertTitle>La IA no está configurada</AlertTitle>
              <AlertDescription>Sin la llave de OpenAI en el servidor no se pueden pedir cambios al guion.</AlertDescription>
            </div>
          </Alert>
        )}
        <form id={formId} noValidate onSubmit={submit} className="space-y-6">
          <div>
            <Label htmlFor={fieldId}>¿Qué quieres cambiar?</Label>
            <Textarea
              ref={field}
              id={fieldId}
              value={observation}
              onChange={(event) => {
                setObservation(event.target.value);
                if (error) setError(null);
              }}
              maxLength={4000}
              className="min-h-[120px]"
              placeholder="Ej. En la escena 2, el título no se entiende: que diga exactamente qué se revisa."
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={`${fieldId}-error ${fieldId}-hint`}
            />
            <FieldError id={`${fieldId}-error`} message={error} />
            <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-muted-foreground">
              La IA cambia solo lo que pidas y el resto del guion queda igual. Nada se aplica hasta que revises la
              propuesta.
            </p>
          </div>
          <div>
            <p id={examplesId} className="mb-1.5 text-[11px] font-bold uppercase tracking-label text-ink-700">
              Ejemplos
            </p>
            <ul aria-labelledby={examplesId} className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <li key={example} className="max-w-full">
                  <button
                    type="button"
                    onClick={() => addExample(example)}
                    className="min-h-10 border border-dashed border-input bg-white px-3 py-1.5 text-left text-sm transition-colors hover:border-ink-800"
                  >
                    <span className="sr-only">Usar el ejemplo: </span>
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-label text-ink-700">Qué escenas</legend>
            <div className="flex flex-wrap gap-2">
              <ChoiceButton
                selected={!scope.length}
                onClick={() => setChosen([])}
                className="min-h-10 px-3 py-1.5 text-sm"
              >
                Todo el guion
              </ChoiceButton>
              {scenes.map((scene, index) => (
                <ChoiceButton
                  key={scene.id}
                  selected={scope.includes(scene.id)}
                  onClick={() => setChosen((list) => toggled(list, scene.id))}
                  className="min-h-10 max-w-full px-3 py-1.5 text-left text-sm"
                >
                  <span className="block truncate">
                    Escena {twoDigits(index + 1)} · {sceneTitle(scene) || "Sin título"}
                  </span>
                </ChoiceButton>
              ))}
            </div>
            {storyboard.isPending && <Skeleton className="mt-2 h-10" />}
            {!storyboard.data && storyboard.isError && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                No se pudieron cargar las escenas: puedes pedir el cambio para todo el guion.
                <Button variant="link" className="text-[13px]" onClick={() => void storyboard.refetch()}>
                  Reintentar
                </Button>
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              {scope.length ? "La IA solo cambia las escenas elegidas." : "La IA decide qué escenas cambiar."}
            </p>
          </fieldset>
        </form>
      </SheetBody>
      <SheetFooter className="flex-col-reverse items-stretch sm:flex-row sm:items-center">
        {onBack ? (
          <Button variant="link" className="text-[13px]" onClick={onBack}>
            Volver a la propuesta
          </Button>
        ) : (
          <span aria-hidden className="hidden sm:block" />
        )}
        <Button type="submit" form={formId} variant="accent" loading={propose.isPending} disabled={!capabilities.ai}>
          <Sparkles /> Pedir propuesta
        </Button>
      </SheetFooter>
    </>
  );
}

interface RevisionViewProps extends SharedProps {
  id: number;
  focus: boolean;
  unsaved: boolean;
  onClose: () => void;
  /** "Pedir otro ajuste": a new observation that replaces this proposal. */
  onAnother: (revision: Revision) => void;
  /** The same observation, to send again (or reword): after a failure, a discard, or a script changed meanwhile. */
  onAskAgain: (revision: Revision, replacing: boolean) => void;
  /** A new observation from scratch. */
  onCompose: () => void;
}

/** One change, as it is now: being prepared (followed until it ends), to review, failed, or no longer pending. */
function RevisionView({ id, focus, ...props }: RevisionViewProps) {
  const { course, module } = props;
  const cache = useRevisionCache();
  const revision = useQuery({
    queryKey: revisionKeys.detail(id),
    queryFn: () => revisionsApi.get(id),
    refetchOnMount: "always", // a copy kept from before may be out of date (applied or discarded elsewhere)
    refetchInterval: (query) => (query.state.data?.status === "proposing" ? PROPOSING_POLL_MS : false),
  });
  const status = revision.data?.status;
  // Seen being prepared here and now ended: the result takes the focus, and the module's flags change.
  const [seen, setSeen] = useState<{ status?: RevisionStatus; ended: boolean }>({ status, ended: false });
  if (status !== seen.status) setSeen({ status, ended: seen.status === "proposing" });
  useEffect(() => {
    if (seen.ended) void cache.refreshChanges(course.id, module.id);
  }, [seen, cache, course.id, module.id]);

  if (revision.isPending) {
    return (
      <SheetBody>
        <Skeleton className="h-64" />
      </SheetBody>
    );
  }
  if (!revision.data) {
    return (
      <SheetBody>
        <QueryError query={revision} />
      </SheetBody>
    );
  }
  const view = { ...props, revision: revision.data, focus: focus || seen.ended };
  switch (revision.data.status) {
    case "proposing":
      return <ProposingView {...view} />;
    case "proposed":
      return <ProposalView {...view} />;
    case "failed":
      return <FailedView {...view} />;
    default:
      return <EndedView {...view} />;
  }
}

type ViewProps = Omit<RevisionViewProps, "id"> & { revision: Revision };

/** Discards the proposal (one being prepared stops): the admin can reword the observation. */
function useDiscard({ course, module, revision, onAskAgain }: ViewProps) {
  const queryClient = useQueryClient();
  const cache = useRevisionCache();
  return useMutation({
    mutationFn: () => revisionsApi.discard(revision.id),
    onSuccess: (discarded) => {
      queryClient.setQueryData(revisionKeys.detail(discarded.id), discarded);
      void cache.refreshChanges(course.id, module.id);
      toast.success("Propuesta descartada");
      onAskAgain(discarded, false);
    },
    onError: (error) => {
      toastError(error);
      void queryClient.invalidateQueries({ queryKey: revisionKeys.detail(revision.id) });
    },
  });
}

function ViewHeading({ focus, children }: { focus: boolean; children: ReactNode }) {
  const heading = useFocusOnMount<HTMLHeadingElement>(focus);
  return (
    <h3 ref={heading} tabIndex={-1} className="font-display text-2xl font-medium tracking-tightest focus-visible:ring-0">
      {children}
    </h3>
  );
}

function ProposingView(props: ViewProps) {
  const { revision, numbers, focus } = props;
  const job = useJob(revision.job_id);
  const discard = useDiscard(props);
  return (
    <>
      <SheetBody className="space-y-5">
        <div className="space-y-2">
          <ViewHeading focus={focus}>Preparando la propuesta</ViewHeading>
          <Asked revision={revision} numbers={numbers} />
        </div>
        <JobStatus job={job.data} fallback="En cola para preparar el cambio" className="max-w-md" />
        <p className="text-sm text-muted-foreground">
          Puedes cerrar este panel: la propuesta queda en el módulo como «Cambio por revisar».
        </p>
      </SheetBody>
      <SheetFooter className="flex-col items-stretch sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" onClick={() => discard.mutate()} loading={discard.isPending}>
          Descartar
        </Button>
      </SheetFooter>
    </>
  );
}

/** The AI's proposal: what it changes scene by scene, what it costs in the video, and the admin's decision. */
function ProposalView(props: ViewProps) {
  const { course, module, storyboard, numbers, revision, focus, unsaved, onClose, onAnother, onAskAgain } = props;
  const queryClient = useQueryClient();
  const cache = useRevisionCache();
  const { trackJobs, failed } = useStudioCache();
  const blockedId = useId();
  const discard = useDiscard(props);
  // The script changed in these scenes since the proposal: it can't be applied as it is.
  const [stale, setStale] = useState<RevisionConflict | null>(null);
  const changes = revision.changes;
  const hasVideo = Boolean(module.video);
  const blocked = unsaved
    ? UNSAVED_APPLY
    : isBusy(module)
      ? "El módulo se está generando; aplica el cambio cuando termine."
      : null;

  const apply = useMutation({
    mutationFn: (render: boolean) => revisionsApi.apply(revision.id, render),
    onSuccess: ({ revision: applied, render_job: renderJob }) => {
      queryClient.setQueryData(revisionKeys.detail(applied.id), applied);
      if (renderJob) trackJobs(course.id, [renderJob]);
      void cache.refreshScript(course.id, module.id);
      const videoBehind = !renderJob && hasVideo && applied.changes?.impact?.needs_render;
      const notes = [
        applied.changes?.rebased && "Se aplicó sobre las ediciones hechas después de la propuesta.",
        videoBehind && "El video no lo refleja hasta que lo vuelvas a producir.",
      ].filter(Boolean);
      toast.success(renderJob ? "Cambio aplicado. El video se está produciendo de nuevo." : "Cambio aplicado", {
        description: notes.join(" ") || undefined,
        // Undoing while its video is being produced is refused: then it waits in the history.
        action: renderJob
          ? undefined
          : { label: "Deshacer", onClick: () => void cache.undo(course.id, module.id, applied.id) },
        duration: 10_000,
      });
      onClose();
    },
    onError: (error) => {
      const conflict = conflictOf(error);
      if (conflict) {
        setStale(conflict);
        void cache.refreshScript(course.id, module.id);
        return;
      }
      failed(course.id)(error);
      void queryClient.invalidateQueries({ queryKey: revisionKeys.detail(revision.id) });
    },
  });
  const busy = apply.isPending || discard.isPending;
  const questions = changes?.affected_question_ids.length ?? 0;

  return (
    <>
      <SheetBody className="space-y-6">
        <div className="space-y-2">
          <ViewHeading focus={focus}>Propuesta de la IA</ViewHeading>
          {revision.summary && <p className="break-words">{revision.summary}</p>}
          <Asked revision={revision} numbers={numbers} />
        </div>
        {stale && (
          <Alert variant="destructive">
            <AlertTriangle />
            <div className="space-y-1">
              <AlertTitle>El guion cambió desde la propuesta</AlertTitle>
              <AlertDescription>{stale.message}</AlertDescription>
              <Button variant="link" className="text-[13px]" onClick={() => onAskAgain(revision, true)}>
                <RotateCcw /> Pedir el cambio de nuevo
              </Button>
            </div>
          </Alert>
        )}
        {revision.unresolved && (
          <Alert variant="warning" role="note">
            <Info />
            <div>
              <AlertTitle>Lo que la IA no pudo hacer</AlertTitle>
              <AlertDescription className="break-words">{revision.unresolved}</AlertDescription>
            </div>
          </Alert>
        )}
        {changes && (
          <>
            <RevisionDiff course={course} module={module} changes={changes} sceneCount={storyboard.data?.scenes.length} />
            <IgnoredChanges ignored={changes.ignored} numbers={numbers} />
            {questions > 0 && (
              <Alert variant="info" role="note">
                <Info />
                <AlertDescription>
                  {questions === 1
                    ? "1 pregunta de la evaluación podría contradecir el guion nuevo: revísala después de aplicar el cambio."
                    : `${plural(questions, "pregunta")} de la evaluación podrían contradecir el guion nuevo: ` +
                      "revísalas después de aplicar el cambio."}
                </AlertDescription>
              </Alert>
            )}
            <RevisionImpactPanel impact={changes.impact} hasVideo={hasVideo} />
          </>
        )}
        {blocked && (
          <p id={blockedId} className="border-l-2 border-warning bg-amber-50 px-4 py-3 text-sm">
            {blocked}
          </p>
        )}
      </SheetBody>
      <SheetFooter className="flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center justify-center gap-6 sm:justify-start">
          <Button variant="link" className="text-[13px]" onClick={() => onAnother(revision)} disabled={busy}>
            Pedir otro ajuste
          </Button>
          <Button
            variant="link"
            className="text-[13px] text-ink-700"
            onClick={() => discard.mutate()}
            loading={discard.isPending}
            disabled={busy}
          >
            Descartar
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant={hasVideo ? "outline" : "accent"}
            onClick={() => apply.mutate(false)}
            loading={apply.isPending && !apply.variables}
            disabled={Boolean(blocked) || Boolean(stale) || busy}
            aria-describedby={blocked ? blockedId : undefined}
          >
            <Check /> Aplicar
          </Button>
          {hasVideo && (
            <Button
              variant="accent"
              onClick={() => apply.mutate(true)}
              loading={apply.isPending && apply.variables}
              disabled={Boolean(blocked) || Boolean(stale) || busy}
              aria-describedby={blocked ? blockedId : undefined}
            >
              <RotateCcw /> Aplicar y volver a producir
            </Button>
          )}
        </div>
      </SheetFooter>
    </>
  );
}

function FailedView({ revision, numbers, focus, onAskAgain }: ViewProps) {
  return (
    <>
      <SheetBody className="space-y-5">
        <ViewHeading focus={focus}>No se pudo preparar la propuesta</ViewHeading>
        <Alert variant="destructive" role="note">
          <AlertTriangle />
          <AlertDescription className="break-words">
            {revision.error || "La IA no respondió. Intenta de nuevo."}
          </AlertDescription>
        </Alert>
        <Asked revision={revision} numbers={numbers} />
      </SheetBody>
      <SheetFooter className="flex-col items-stretch sm:flex-row sm:items-center sm:justify-end">
        <Button variant="accent" onClick={() => onAskAgain(revision, false)}>
          <Sparkles /> Pedir de nuevo
        </Button>
      </SheetFooter>
    </>
  );
}

/** Why a change that was shown is no longer pending (applied, discarded or replaced elsewhere, undone). */
const ENDED: Partial<Record<RevisionStatus, string>> = {
  applied: "Este cambio ya se aplicó. Para quitarlo, usa «Deshacer» en el historial.",
  discarded: "Esta propuesta se descartó.",
  superseded: "Esta propuesta se reemplazó por un pedido más reciente.",
  reverted: "Este cambio se aplicó y después se deshizo.",
};

function EndedView({ revision, numbers, focus, onCompose }: ViewProps) {
  return (
    <>
      <SheetBody className="space-y-4">
        <ViewHeading focus={focus}>Ya no está pendiente</ViewHeading>
        <p>{ENDED[revision.status] ?? "Este cambio ya no está pendiente."}</p>
        {revision.observation && <Asked revision={revision} numbers={numbers} />}
      </SheetBody>
      <SheetFooter className="flex-col items-stretch sm:flex-row sm:items-center sm:justify-end">
        <Button variant="accent" onClick={onCompose}>
          <Sparkles /> Pedir otro cambio
        </Button>
      </SheetFooter>
    </>
  );
}
