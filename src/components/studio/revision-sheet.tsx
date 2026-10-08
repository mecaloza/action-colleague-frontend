"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, Info, RotateCcw, Sparkles } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { ACTIVITY_LABELS } from "@/components/learn/activities/activity-player";
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
import { activitiesApi, activityKeys } from "@/lib/api/activities";
import { ApiError } from "@/lib/api/client";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import { revisionKeys, revisionsApi } from "@/lib/api/revisions";
import { STUDIO_STALE_MS, studioApi, studioKeys } from "@/lib/api/studio";
import type {
  ActivityAdmin,
  CourseDetail,
  Job,
  ModuleAdmin,
  Revision,
  RevisionApplied,
  RevisionChanges,
  RevisionConflict,
  RevisionCreate,
  RevisionStatus,
  RevisionSummary,
  RevisionTarget,
} from "@/lib/api/types";
import { plural, twoDigits } from "@/lib/format";
import { useJob } from "@/lib/hooks/use-jobs";
import { matchesMedia, TOUCH_ONLY } from "@/lib/hooks/use-media-query";
import { useOpening } from "@/lib/hooks/use-opening";
import { useStudioCapabilities } from "@/lib/hooks/use-studio-capabilities";
import { toastError } from "@/lib/notify";
import { toggled } from "@/lib/utils";
import { ActivityReachPanel, ActivityRevisionDiff } from "./activity-revision-diff";
import { ChoiceButton } from "./choice-button";
import { JobStatus } from "./job-status";
import { QuizReachPanel, QuizRevisionDiff } from "./quiz-revision-diff";
import { inRenderSlot } from "./render-slots";
import {
  capitalized,
  IgnoredChanges,
  leavesVideoBehind,
  RevisionDiff,
  RevisionImpactPanel,
  sceneTitle,
} from "./revision-diff";
import { isPendingRevision, RevisionHistory, useRevisionHistory } from "./revision-history";
import { type ModuleActivity, moduleActivity } from "./steps";
import { useConfirmProduce } from "./use-produce-module";
import { hasUnsavedEdits, type RevisionRef, useRevisionCache } from "./use-revision-cache";
import { useStudioCache } from "./use-studio-cache";

/** A proposal being prepared is followed this often. */
const PROPOSING_POLL_MS = 2000;

/** How the panel speaks of what a change is to. */
interface Words {
  /** The panel's title. */
  title: string;
  /** "al guion": "no se pueden pedir cambios al guion". */
  to: string;
  /** "del guion": "el resto del guion", "Cambios del guion". */
  of: string;
  /** "El guion": "El guion cambió desde la propuesta". */
  it: string;
  /** Where a proposal waits for the admin: "la propuesta queda en el módulo como «Cambio por revisar»". */
  waitsIn: string;
  /** What its history says while it has none. */
  empty: string;
  /** Observations to start from: a tap adds one to the text. */
  examples: string[];
  placeholder: string;
}

const WORDS: Record<RevisionTarget, Words> = {
  script: {
    title: "Cambios al guion",
    to: "al guion",
    of: "del guion",
    it: "El guion",
    waitsIn: "el módulo",
    empty: "Todavía no hay cambios en el guion de este módulo.",
    examples: [
      "El título no se entiende: que diga exactamente qué se revisa.",
      "Acorta la narración y nombra los puntos en el orden en que aparecen.",
      "Agrega un ejemplo concreto del trabajo diario.",
      "La infografía se ve mal: haz otra versión.",
    ],
    placeholder: "Ej. En la escena 2, el título no se entiende: que diga exactamente qué se revisa.",
  },
  quiz: {
    title: "Cambios a la evaluación",
    to: "a la evaluación",
    of: "de la evaluación",
    it: "La evaluación",
    waitsIn: "la evaluación",
    empty: "Todavía no hay cambios en la evaluación de este módulo.",
    examples: [
      "La pregunta no se entiende: que diga exactamente qué se pregunta.",
      "Dos opciones podrían ser correctas: que solo una lo sea.",
      "Que la explicación diga por qué las otras opciones están mal.",
      "Agrega una pregunta sobre un caso del trabajo diario.",
    ],
    placeholder: "Ej. En la pregunta 3, dos opciones parecen correctas: que solo una lo sea.",
  },
  activity: {
    title: "Cambios a la actividad",
    to: "a la actividad",
    of: "de la actividad",
    it: "La actividad",
    waitsIn: "la actividad",
    empty: "Todavía no hay cambios en esta actividad.",
    examples: [
      "Que la introducción diga qué se gana al hacerlo bien.",
      "La respuesta correcta es demasiado obvia: que cueste más distinguirla.",
      "Usa las palabras y las cifras del módulo.",
      "Acorta los textos que se dicen con voz.",
    ],
    placeholder: "Ej. La consecuencia de la primera opción es vaga: que diga qué pasa con el costo.",
  },
};

const unsavedApply = (words: Words) =>
  `Guarda o descarta los cambios ${words.of} en el editor: aplicar la propuesta los reemplazaría.`;
const unsavedUndo = (words: Words) =>
  `Guarda o descarta los cambios ${words.of} en el editor: deshacer un cambio los reemplazaría.`;

/** Why a script's proposal can't be applied while the module is busy (as the server says it). */
const BUSY: Record<NonNullable<ModuleActivity>, string> = {
  rendering: "El video se está produciendo; aplica el cambio cuando termine.",
  drafting: "El guion se está generando; aplica el cambio cuando termine.",
};

export type RevisionTab = "change" | "history";

/** A finding of the video's review a change is asked for: once the change is applied it shows as fixed. */
export interface QaIssueRef {
  id: string;
  /** What the review found ("" when not known here). */
  description: string;
}

/** What the sheet opens on. */
export interface RevisionRequest {
  moduleId: number;
  /** What changes: the module's script (left out), its quiz, or one of its activities (`activityId`). */
  target?: RevisionTarget;
  activityId?: number;
  /** The scenes a new change to the script starts scoped to (a scene's own button). */
  sceneIds?: string[];
  /** The questions a new change to the quiz starts scoped to (a question's own button). */
  questionIds?: string[];
  /** The observation a new change starts with (the admin can reword it). */
  observation?: string;
  /** The finding of the video's review the change fixes («Corregir»). */
  qaIssue?: QaIssueRef;
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

/** How a script's scenes or a quiz's questions are called: what a change can be about. */
interface ScopeWords {
  one: string;
  many: string;
  /** All of them: what a change is about when none is chosen. */
  all: string;
}

const SCENES: ScopeWords = { one: "escena", many: "escenas", all: "Todo el guion" };
const QUESTIONS: ScopeWords = { one: "pregunta", many: "preguntas", all: "Toda la evaluación" };

/** The scenes of a script or the questions of a quiz: a change can be about some of them. */
interface Scope {
  words: ScopeWords;
  /** Where they come from (the saved script or quiz): loading, failed, loaded again. */
  query: UseQueryResult<unknown>;
  /** In order, with the name each one is shown with. */
  items: { id: string; name: string }[];
  /** Their numbers as they are now (1 = first). */
  numbers: Map<string, number>;
  /** The ones a new change starts on (a scene's or question's own button). */
  requested: string[];
  /** The ones a change was about. */
  of: (revision: Revision) => string[];
}

/** What a change is to (the module's script, its quiz or one of its activities), and how the panel speaks of it. */
interface Subject {
  ref: RevisionRef;
  words: Words;
  /** An activity's change: the activity, as saved. */
  activity: ActivityAdmin | null;
  /** A script's scenes or a quiz's questions; null for an activity's change. */
  scope: Scope | null;
}

const NO_NUMBERS = new Map<string, number>();

/** "Escena 02", "Preguntas 02 y 05" or "Todo el guion": what a change is about, numbered as it is now. */
function scopeLabel(ids: string[], scope: Scope): string {
  const { words, numbers } = scope;
  if (!ids.length) return words.all;
  const listed = ids
    .map((id) => numbers.get(id))
    .filter((number): number is number => number !== undefined)
    .sort((a, b) => a - b)
    .map(twoDigits);
  if (!listed.length) return plural(ids.length, words.one);
  if (listed.length === 1) return `${capitalized(words.one)} ${listed[0]}`;
  return `${capitalized(words.many)} ${listed.slice(0, -1).join(", ")} y ${listed[listed.length - 1]}`;
}

/** What is sent to ask for a change: only the fields its target takes (and the review's finding it fixes, if any). */
function proposal(
  { target, activityId }: RevisionRef,
  observation: string,
  chosen: string[],
  qaIssue: QaIssueRef | null,
): RevisionCreate {
  const ids = chosen.length ? chosen : null;
  const fixes = qaIssue ? { qa_issue_id: qaIssue.id } : {};
  if (target === "quiz") return { target, observation, question_ids: ids, ...fixes };
  if (target === "activity") return { target, observation, activity_id: activityId, ...fixes };
  return { target, observation, scene_ids: ids, ...fixes };
}

/**
 * The 409 of a change whose places (scenes and reading, questions, parts of an activity) changed since it was made:
 * where, to say it and ask again.
 */
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
  /** The scenes or questions it is about (none: all of them). */
  scope: string[];
  /** The proposal it replaces ("Pedir otro ajuste", a scene's own button): the admin can go back to it. */
  replacing: Pick<RevisionSummary, "id" | "observation"> | null;
  /** The finding of the video's review it fixes. */
  qaIssue: QaIssueRef | null;
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
  /**
   * What the change is to has edits not saved in its editor (the module's script, its quiz): applying or undoing
   * would replace them.
   */
  unsaved?: boolean;
  /** The course's active jobs, where the page has them: what a busy module is doing (otherwise it is guessed). */
  jobs?: Job[];
  /**
   * The id of where the focus goes as the panel closes if what opened it is gone: what the change is about on the
   * page. Applying or undoing a change draws a quiz's editor again, and takes away the «Cambio por revisar» that may
   * have opened it.
   */
  focusFallbackId?: (request: RevisionRequest) => string | undefined;
}

/**
 * "Pedir un cambio": an observation about the module's script (all of it or some scenes), its quiz (all of it or some
 * questions) or one of its activities -> the AI's proposal, shown as a diff with what it means (producing the video
 * again, the people taking the course) -> applied (a script's, maybe with its video), asked again or discarded. Its
 * history lists every change to it, applied ones with «Deshacer».
 */
export function RevisionSheet({
  course,
  request,
  open,
  openingKey,
  onClose,
  unsaved = false,
  jobs = [],
  focusFallbackId,
}: RevisionSheetProps) {
  const revised = course.modules.find((each) => each.id === request?.moduleId) ?? null;
  const fallbackId = request && focusFallbackId?.(request);
  return (
    <Sheet open={open && revised !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        className="w-full sm:max-w-3xl"
        fallbackFocus={fallbackId ? () => document.getElementById(fallbackId) : undefined}
      >
        {revised && request && (
          <RevisionPanel
            key={openingKey}
            course={course}
            module={revised}
            busy={moduleActivity(revised, jobs)}
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
  /** What the module is doing (writing its script, producing its video): a script's change waits meanwhile. */
  busy: ModuleActivity;
  request: RevisionRequest;
  unsaved: boolean;
  onClose: () => void;
}

/** The panel of a change to the module's script, its quiz or one of its activities: each loads what it is about. */
function RevisionPanel(props: PanelProps) {
  switch (props.request.target ?? "script") {
    case "quiz":
      return <QuizPanel {...props} />;
    case "activity":
      return <ActivityPanel {...props} />;
    default:
      return <ScriptPanel {...props} />;
  }
}

function ScriptPanel(props: PanelProps) {
  const { module, request, unsaved } = props;
  const storyboard = useQuery({
    queryKey: studioKeys.storyboard(module.id),
    // The server draws the slides to check them: two at a time, like the previews.
    queryFn: ({ signal }) => inRenderSlot(signal, () => studioApi.storyboard(module.id, signal)),
    gcTime: 0, // the script editor's own copy (same key): dropped as it closes, so it never opens stale
    staleTime: STUDIO_STALE_MS,
    // A new copy restarts the editor's form: never over its unsaved edits (as the editor itself does).
    refetchOnMount: !unsaved,
  });
  const scenes = storyboard.data?.scenes ?? [];
  const scope: Scope = {
    words: SCENES,
    query: storyboard,
    items: scenes.map((scene) => ({ id: scene.id, name: sceneTitle(scene) || "Sin título" })),
    numbers: new Map(scenes.map((scene, index) => [scene.id, index + 1])),
    requested: request.sceneIds ?? [],
    of: (revision) => revision.scope.scene_ids,
  };
  const subject: Subject = { ref: { target: "script", moduleId: module.id }, words: WORDS.script, activity: null, scope };
  return <PanelBody {...props} subject={subject} />;
}

function QuizPanel(props: PanelProps) {
  const { module, request, unsaved } = props;
  const evaluation = useQuery({
    queryKey: courseKeys.evaluation(module.id),
    queryFn: () => coursesApi.findEvaluation(module.id),
    // A new copy restarts the quiz's editor (the same query): never over its unsaved edits.
    refetchOnMount: !unsaved,
  });
  const questions = evaluation.data?.questions ?? [];
  const scope: Scope = {
    words: QUESTIONS,
    query: evaluation,
    items: questions.map((question) => ({ id: question.id, name: question.prompt.trim() || "Sin enunciado" })),
    numbers: new Map(questions.map((question, index) => [question.id, index + 1])),
    requested: request.questionIds ?? [],
    of: (revision) => revision.scope.question_ids,
  };
  const subject: Subject = { ref: { target: "quiz", moduleId: module.id }, words: WORDS.quiz, activity: null, scope };
  return <PanelBody {...props} subject={subject} />;
}

function ActivityPanel(props: PanelProps) {
  const { module, request } = props;
  const activities = useQuery({
    queryKey: activityKeys.module(module.id),
    queryFn: () => activitiesApi.list(module.id),
  });
  const activity = activities.data?.find((each) => each.id === request.activityId) ?? null;
  if (!activity) {
    return (
      <>
        <PanelHeader module={module} words={WORDS.activity} activity={null} />
        {activities.isPending ? (
          <LoadingBody />
        ) : (
          <SheetBody>
            {activities.data ? <p>Esta actividad ya no existe.</p> : <QueryError query={activities} />}
          </SheetBody>
        )}
      </>
    );
  }
  const subject: Subject = {
    ref: { target: "activity", moduleId: module.id, activityId: activity.id },
    words: WORDS.activity,
    activity,
    scope: null,
  };
  return <PanelBody {...props} subject={subject} />;
}

function PanelHeader({ module, words, activity }: { module: ModuleAdmin; words: Words; activity: ActivityAdmin | null }) {
  return (
    <SheetHeader className="border-b-0 pb-3">
      <p className="eyebrow mb-2">
        Módulo {twoDigits(module.order)}
        {activity && ` · ${ACTIVITY_LABELS[activity.type]}`}
      </p>
      <SheetTitle className="font-display text-2xl font-medium tracking-tightest">{words.title}</SheetTitle>
      <SheetDescription className="mt-1 break-words text-sm text-muted-foreground">
        {activity?.title ?? module.title}
      </SheetDescription>
    </SheetHeader>
  );
}

function PanelBody({ course, module, busy, request, unsaved, onClose, subject }: PanelProps & { subject: Subject }) {
  const cache = useRevisionCache();
  const unsavedId = useId();
  const [tab, setTab] = useState<RevisionTab>(request.tab ?? "change");
  // What waits for review may have changed elsewhere (another tab, another admin).
  const history = useRevisionHistory(subject.ref, "always");
  const { scope, words } = subject;
  const numbers = scope?.numbers ?? NO_NUMBERS;
  const requested = scope?.requested ?? [];

  const [view, setView] = useState<View | null>(null);
  const go = (next: ViewTarget) => {
    setTab("change");
    setView((current) => ({ ...next, serial: (current?.serial ?? 0) + 1, focus: true }));
  };
  const composing = (from: Partial<ComposeState> = {}): ViewTarget => ({
    kind: "compose",
    observation: "",
    scope: requested,
    replacing: null,
    qaIssue: null,
    ...from,
  });
  const compose = (from?: Partial<ComposeState>) => go(composing(from));
  // The finding of the video's review a change was asked for (as the request knows it, with what it found).
  const qaIssueOf = (revision: Revision): QaIssueRef | null => {
    const id = revision.scope.qa_issue_id;
    if (!id) return null;
    return request.qaIssue?.id === id ? request.qaIssue : { id, description: "" };
  };
  // As it opens (from the server's answer, not a copy kept from before): a proposal still waiting is shown first
  // (asking for another replaces it); otherwise the form. A scene's or question's own button, or a finding of the
  // video's review («Corregir», with its observation), opens the form on it, saying which proposal it replaces; not
  // while one is being prepared (another can't be asked until it ends), nor over the same finding's proposal.
  if (view === null && !history.isPending && !history.isFetching) {
    const pending = history.data?.find(isPendingRevision);
    const asked = { observation: request.observation ?? "", qaIssue: request.qaIssue ?? null };
    const ownRequest = requested.length > 0 || asked.qaIssue !== null;
    const sameFinding =
      asked.qaIssue !== null && pending?.source === "qa" && pending.observation === asked.observation.trim();
    const first: ViewTarget = !pending
      ? composing(asked)
      : ownRequest && pending.status === "proposed" && !sameFinding
        ? composing({ ...asked, replacing: pending })
        : { kind: "revision", id: pending.id };
    setView({ ...first, serial: 0, focus: false });
  }
  // The proposal the form replaces, to go back to it.
  const replaced = view?.kind === "compose" ? view.replacing : null;

  const shared = { course, module, busy, subject, numbers };
  return (
    <>
      <PanelHeader module={module} words={words} activity={subject.activity} />
      <Tabs value={tab} onValueChange={(value) => setTab(value as RevisionTab)} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 px-6">
          <TabsTrigger value="change">Pedir un cambio</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        {/* Kept while the history is shown: what is being written (or prepared) is still there on coming back. An
            inactive panel is only `hidden`, which its `flex` would override: hidden by its state instead. */}
        <TabsContent value="change" forceMount className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          {view === null ? (
            <LoadingBody />
          ) : view.kind === "compose" ? (
            <ComposeView
              key={view.serial}
              {...shared}
              start={view}
              focus={view.focus}
              unsaved={unsaved}
              onProposed={(revision) => go({ kind: "revision", id: revision.id })}
              onBack={replaced ? () => go({ kind: "revision", id: replaced.id }) : undefined}
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
                  scope: requested.length ? requested : (scope?.of(revision) ?? []),
                  replacing: revision,
                  qaIssue: qaIssueOf(revision), // another way to fix the same finding
                })
              }
              onAskAgain={(revision, replacing) =>
                compose({
                  observation: revision.observation,
                  scope: scope?.of(revision) ?? [],
                  replacing: replacing ? revision : null,
                  qaIssue: qaIssueOf(revision),
                })
              }
              onCompose={() => compose()}
            />
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <SheetBody className="space-y-4">
            {unsaved && <BlockedNote id={unsavedId}>{unsavedUndo(words)}</BlockedNote>}
            <RevisionHistory
              subject={subject.ref}
              label={`Cambios ${words.of}`}
              empty={words.empty}
              blockedBy={unsaved ? unsavedId : undefined}
              onUndo={(revisionId) => cache.undo(course.id, subject.ref, revisionId)}
              onShow={(revisionId) => go({ kind: "revision", id: revisionId })}
            />
          </SheetBody>
        </TabsContent>
      </Tabs>
    </>
  );
}

function LoadingBody() {
  return (
    <SheetBody>
      <Skeleton className="h-64" />
    </SheetBody>
  );
}

/** Why applying or undoing is held back; the buttons point at it. */
function BlockedNote({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="border-l-2 border-warning bg-amber-50 px-4 py-3 text-sm">
      {children}
    </p>
  );
}

interface SharedProps {
  course: CourseDetail;
  module: ModuleAdmin;
  /** What the module is doing (writing its script, producing its video): a script's change waits meanwhile. */
  busy: ModuleActivity;
  subject: Subject;
  /** The numbers of the scenes or questions, as they are now (none for an activity). */
  numbers: Map<string, number>;
}

/** What was asked for: the observation and, a script's or quiz's, its scenes or questions (and what it fixes). */
function Asked({ revision, subject }: { revision: Revision; subject: Subject }) {
  const { scope } = subject;
  return (
    <p className="break-words text-sm text-muted-foreground">
      Pediste: «{revision.observation}»{scope && ` · ${scopeLabel(scope.of(revision), scope)}`}
      {revision.scope.qa_issue_id && " · Corrige un hallazgo de la revisión de calidad"}
    </p>
  );
}

/** The finding of the video's review the change fixes, said above the form. */
function FixesNote({ qaIssue }: { qaIssue: QaIssueRef }) {
  // Quoted without its own final period: «… en el borde derecho».
  const found = qaIssue.description.trim().replace(/\.$/, "");
  return (
    <p className="break-words border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm">
      {found ? (
        <>Corrige lo que encontró la revisión de calidad: «{found}».</>
      ) : (
        "Corrige un hallazgo de la revisión de calidad."
      )}{" "}
      Al aplicar el cambio, el hallazgo queda corregido.
    </p>
  );
}

interface ComposeViewProps extends SharedProps {
  start: ComposeState;
  focus: boolean;
  /** What it is about has edits not saved in its editor: its scenes or questions aren't loaded again over them. */
  unsaved: boolean;
  onProposed: (revision: Revision) => void;
  /** Back to the proposal the new one would replace. */
  onBack?: () => void;
}

/**
 * The observation (with examples to start from) and, a script's or quiz's, the scenes or questions it is about: the
 * AI proposes, nothing is applied.
 */
function ComposeView({ course, module, subject, numbers, start, focus, unsaved, onProposed, onBack }: ComposeViewProps) {
  const { ref, words, scope } = subject;
  const formId = useId();
  const fieldId = useId();
  const examplesId = useId();
  const queryClient = useQueryClient();
  const cache = useRevisionCache();
  const { trackJobs, failed } = useStudioCache();
  const capabilities = useStudioCapabilities();
  const [observation, setObservation] = useState(start.observation);
  const [chosen, setChosen] = useState(start.scope);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // On a touch screen the keyboard would pop up over the panel: there the admin taps the field.
  useEffect(() => {
    if (focus && !matchesMedia(TOUCH_ONLY)) field.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only as the form appears
  }, []);
  // A chosen scene or question no longer there (removed meanwhile) isn't asked for.
  const inScope = scope?.query.data ? chosen.filter((id) => numbers.has(id)) : chosen;

  const propose = useMutation({
    mutationFn: () => revisionsApi.propose(module.id, proposal(ref, observation.trim(), inScope, start.qaIssue)),
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
      // A chosen scene or question is gone (edited elsewhere): they are loaded again, but not over edits not saved in
      // the open editor (a new copy would restart it).
      if (problem instanceof ApiError && problem.status === 422 && !unsaved) void scope?.query.refetch();
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
        {start.qaIssue && <FixesNote qaIssue={start.qaIssue} />}
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
              <AlertDescription>
                Sin la llave de OpenAI en el servidor no se pueden pedir cambios {words.to}.
              </AlertDescription>
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
              placeholder={words.placeholder}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={`${fieldId}-error ${fieldId}-hint`}
            />
            <FieldError id={`${fieldId}-error`} message={error} />
            <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-muted-foreground">
              La IA cambia solo lo que pidas y el resto {words.of} queda igual. Nada se aplica hasta que revises la
              propuesta.
            </p>
          </div>
          <div>
            <p id={examplesId} className="mb-1.5 text-[11px] font-bold uppercase tracking-label text-ink-700">
              Ejemplos
            </p>
            <ul aria-labelledby={examplesId} className="flex flex-wrap gap-2">
              {words.examples.map((example) => (
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
          {scope && (
            // A fieldset is as wide as its widest line by default: here it takes the panel's width.
            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-label text-ink-700">
                Qué {scope.words.many}
              </legend>
              <div className="flex flex-wrap gap-2">
                <ChoiceButton
                  selected={!inScope.length}
                  onClick={() => setChosen([])}
                  className="min-h-10 px-3 py-1.5 text-sm"
                >
                  {scope.words.all}
                </ChoiceButton>
                {scope.items.map((item, index) => (
                  <ChoiceButton
                    key={item.id}
                    selected={inScope.includes(item.id)}
                    onClick={() => setChosen((list) => toggled(list, item.id))}
                    className="min-h-10 max-w-full px-3 py-1.5 text-left text-sm"
                  >
                    {/* A long title (a question's prompt) takes two lines at most. */}
                    <span className="line-clamp-2 break-words">
                      {capitalized(scope.words.one)} {twoDigits(index + 1)} · {item.name}
                    </span>
                  </ChoiceButton>
                ))}
              </div>
              {scope.query.isPending && <Skeleton className="mt-2 h-10" />}
              {!scope.query.data && scope.query.isError && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  No se pudieron cargar las {scope.words.many}: puedes pedir el cambio para{" "}
                  {scope.words.all.toLowerCase()}.
                  <Button variant="link" className="text-[13px]" onClick={() => void scope.query.refetch()}>
                    Reintentar
                  </Button>
                </p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {inScope.length
                  ? `La IA solo cambia las ${scope.words.many} elegidas.`
                  : `La IA decide qué ${scope.words.many} cambiar.`}
              </p>
            </fieldset>
          )}
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
  /** The same observation, to send again (or reword): after a failure, a discard, or a content changed meanwhile. */
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

  if (revision.isPending) return <LoadingBody />;
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
  const { revision, subject, focus } = props;
  const job = useJob(revision.job_id);
  const discard = useDiscard(props);
  return (
    <>
      <SheetBody className="space-y-5">
        <div className="space-y-2">
          <ViewHeading focus={focus}>Preparando la propuesta</ViewHeading>
          <Asked revision={revision} subject={subject} />
        </div>
        <JobStatus job={job.data} fallback="En cola para preparar el cambio" className="max-w-md" />
        <p className="text-sm text-muted-foreground">
          Puedes cerrar este panel: la propuesta queda en {subject.words.waitsIn} como «Cambio por revisar».
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

interface ProposedChangesProps {
  course: CourseDetail;
  module: ModuleAdmin;
  subject: Subject;
  revision: Revision;
  changes: RevisionChanges;
  numbers: Map<string, number>;
}

/**
 * What the proposal changes, in each target's terms: a script's scenes (and what producing the video again takes), a
 * quiz's questions or an activity's parts (and whom they reach as soon as they are applied).
 */
function ProposedChanges({ course, module, subject, revision, changes, numbers }: ProposedChangesProps) {
  const { scope, activity } = subject;
  const learners = revision.learners ?? null;
  const coursePublished = course.status === "published";
  switch (subject.ref.target) {
    case "quiz":
      return (
        <>
          <QuizRevisionDiff changes={changes} />
          <IgnoredChanges ignored={changes.ignored} numbers={numbers} noun="pregunta" />
          <QuizReachPanel changes={changes} learners={learners} coursePublished={coursePublished} />
        </>
      );
    case "activity":
      return activity && changes.activity ? (
        <>
          <ActivityRevisionDiff change={changes.activity} activity={activity} />
          <ActivityReachPanel
            activity={activity}
            learners={learners}
            coursePublished={coursePublished}
            linesChanged={changes.activity.lines_changed}
          />
        </>
      ) : null;
    default: {
      const questions = changes.affected_question_ids.length;
      return (
        <>
          <RevisionDiff
            course={course}
            module={module}
            changes={changes}
            sceneCount={scope?.query.data ? scope.items.length : undefined}
          />
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
          <RevisionImpactPanel changes={changes} hasVideo={Boolean(module.video)} />
        </>
      );
    }
  }
}

/** What else the toast of an applied change says: the finding of the video's review it fixed, what is still to come. */
function appliedNotes(subject: Subject, { revision, render_job: renderJob }: RevisionApplied, hasVideo: boolean) {
  const { changes } = revision;
  const fixed = revision.scope.qa_issue_id ? ["El hallazgo de la revisión de calidad quedó corregido."] : [];
  if (subject.ref.target === "script") {
    const videoBehind = !renderJob && changes !== null && leavesVideoBehind(changes, hasVideo);
    return videoBehind ? [...fixed, "El video no lo refleja hasta que lo vuelvas a producir."] : fixed;
  }
  // A published activity's new lines are voiced (the others keep their voice).
  const voiced = subject.activity?.status === "ready" && (changes?.activity?.lines_changed ?? 0) > 0;
  return voiced ? [...fixed, "La voz de las líneas nuevas se está grabando."] : fixed;
}

/** The AI's proposal: what it changes, what it means, and the admin's decision. */
function ProposalView(props: ViewProps) {
  const { course, module, busy, subject, numbers, revision, focus, unsaved, onClose, onAnother, onAskAgain } = props;
  const { ref, words } = subject;
  const queryClient = useQueryClient();
  const cache = useRevisionCache();
  const { trackJobs, failed } = useStudioCache();
  const confirmProduce = useConfirmProduce(course);
  const blockedId = useId();
  const discard = useDiscard(props);
  // What the change touches changed since the proposal: it can't be applied as it is.
  const [stale, setStale] = useState<RevisionConflict | null>(null);
  const changes = revision.changes;
  const hasVideo = Boolean(module.video);
  const script = ref.target === "script";
  // Producing the video again is offered only when a change to the script touches what it shows.
  const needsRender = script && changes !== null && leavesVideoBehind(changes, hasVideo);
  const blocked = unsaved ? unsavedApply(words) : script && busy ? BUSY[busy] : null;

  const apply = useMutation({
    mutationFn: (render: boolean) => revisionsApi.apply(revision.id, render),
    onSuccess: async (result) => {
      const { revision: applied, render_job: renderJob } = result;
      if (renderJob) trackJobs(course.id, [renderJob]);
      const refreshed = cache.refreshContent(course.id, ref);
      // A quiz's editor starts over with the new questions, and «Cambio por revisar» goes away: the panel closes once
      // the page shows them, so the focus goes back to what opened it or to what took its place. (A script's copy is
      // slow to load, its slides are drawn: the panel doesn't wait for it.)
      if (!script) await refreshed;
      queryClient.setQueryData(revisionKeys.detail(applied.id), applied);
      const notes = [
        applied.changes?.rebased && "Se aplicó sobre las ediciones hechas después de la propuesta.",
        ...appliedNotes(subject, result, hasVideo),
      ].filter(Boolean);
      toast.success(renderJob ? "Cambio aplicado. El video se está produciendo de nuevo." : "Cambio aplicado", {
        description: notes.join(" ") || undefined,
        // Undoing while its video is being produced is refused: then it waits in the history.
        action: renderJob
          ? undefined
          : {
              label: "Deshacer",
              onClick: (event) => {
                // The toast outlives the panel: by now the open editor may have edits that undoing would replace.
                // Then it stays, to undo once they are saved or discarded.
                if (hasUnsavedEdits(ref)) {
                  event.preventDefault();
                  toast.error(unsavedUndo(words));
                  return;
                }
                void cache.undo(course.id, ref, applied.id);
              },
            },
        duration: 10_000,
      });
      onClose();
    },
    onError: (error) => {
      const conflict = conflictOf(error);
      if (conflict) {
        setStale(conflict);
        void cache.refreshContent(course.id, ref);
        return;
      }
      failed(course.id)(error);
      void queryClient.invalidateQueries({ queryKey: revisionKeys.detail(revision.id) });
    },
  });
  const busyHere = apply.isPending || discard.isPending;
  const cannotApply = Boolean(blocked) || Boolean(stale) || busyHere;

  // As producing the video anywhere else: people taking a published course would get the new video.
  const applyAndProduce = async () => {
    if (await confirmProduce(module, "Aplicar y volver a producir")) apply.mutate(true);
  };

  return (
    <>
      <SheetBody className="space-y-6">
        <div className="space-y-2">
          <ViewHeading focus={focus}>Propuesta de la IA</ViewHeading>
          {revision.summary && <p className="break-words">{revision.summary}</p>}
          <Asked revision={revision} subject={subject} />
        </div>
        {stale && (
          <Alert variant="destructive">
            <AlertTriangle />
            <div className="space-y-1">
              <AlertTitle>{words.it} cambió desde la propuesta</AlertTitle>
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
          <ProposedChanges
            course={course}
            module={module}
            subject={subject}
            revision={revision}
            changes={changes}
            numbers={numbers}
          />
        )}
        {blocked && <BlockedNote id={blockedId}>{blocked}</BlockedNote>}
      </SheetBody>
      <SheetFooter className="flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center justify-center gap-6 sm:justify-start">
          <Button variant="link" className="text-[13px]" onClick={() => onAnother(revision)} disabled={busyHere}>
            Pedir otro ajuste
          </Button>
          <Button
            variant="link"
            className="text-[13px] text-ink-700"
            onClick={() => discard.mutate()}
            loading={discard.isPending}
            disabled={busyHere}
          >
            Descartar
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant={needsRender ? "outline" : "accent"}
            onClick={() => apply.mutate(false)}
            loading={apply.isPending && !apply.variables}
            disabled={cannotApply}
            aria-describedby={blocked ? blockedId : undefined}
          >
            <Check /> Aplicar
          </Button>
          {needsRender && (
            <Button
              variant="accent"
              onClick={() => void applyAndProduce()}
              loading={apply.isPending && apply.variables}
              disabled={cannotApply}
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

function FailedView({ revision, subject, focus, onAskAgain }: ViewProps) {
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
        <Asked revision={revision} subject={subject} />
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

function EndedView({ revision, subject, focus, onCompose }: ViewProps) {
  return (
    <>
      <SheetBody className="space-y-4">
        <ViewHeading focus={focus}>Ya no está pendiente</ViewHeading>
        <p>{ENDED[revision.status] ?? "Este cambio ya no está pendiente."}</p>
        {revision.observation && <Asked revision={revision} subject={subject} />}
      </SheetBody>
      <SheetFooter className="flex-col items-stretch sm:flex-row sm:items-center sm:justify-end">
        <Button variant="accent" onClick={onCompose}>
          <Sparkles /> Pedir otro cambio
        </Button>
      </SheetFooter>
    </>
  );
}
