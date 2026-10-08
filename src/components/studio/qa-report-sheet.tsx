"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, EyeOff, Loader2, PlayCircle, RotateCcw, ScanSearch, Undo2, Wrench } from "lucide-react";
import { ModuleVideo } from "@/components/courses/module-video";
import { QueryError } from "@/components/layout/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { STUDIO_STALE_MS, studioApi, studioKeys } from "@/lib/api/studio";
import type { CourseDetail, Job, ModuleAdmin, ReviewIssue, StoryboardScene, VideoReview } from "@/lib/api/types";
import { formatDate, formatDuration, formatRelative, twoDigits } from "@/lib/format";
import { useJob } from "@/lib/hooks/use-jobs";
import { useOpening } from "@/lib/hooks/use-opening";
import { useStudioCapabilities } from "@/lib/hooks/use-studio-capabilities";
import { cn } from "@/lib/utils";
import { JobStatus } from "./job-status";
import {
  CATEGORIES,
  foundSentence,
  groupIssues,
  isOpen,
  isReviewing,
  pendingSentence,
  reviewEnded,
  sceneNumbers,
  SEVERITIES,
  SOURCES,
} from "./qa";
import { FrameDialog, FrameGrid, FrameImage, IssueStatusBadge, issuesOn, sceneLabel } from "./qa-frames";
import { inRenderSlot } from "./render-slots";
import { sceneTitle } from "./revision-diff";
import { RevisionSheet, useRevisionSheet } from "./revision-sheet";
import { moduleActivity, type ModuleActivity } from "./steps";
import { type IssueAction, useIssueAction, useRequestReview, useVideoReview } from "./use-video-review";

/** Open state of a `QaReportSheet`: `show` opens it on a module, each time afresh. */
export function useQaSheet() {
  const opening = useOpening<number | null>(null);
  return {
    show: (moduleId: number) => opening.show(moduleId),
    /** Its props. */
    sheet: { moduleId: opening.value, open: opening.open, openingKey: opening.key, onClose: opening.hide },
  };
}

interface QaReportSheetProps {
  course: CourseDetail;
  moduleId: number | null;
  open: boolean;
  /** Each opening starts afresh. */
  openingKey: number;
  onClose: () => void;
  /** The course's active jobs, where the page has them: what a busy module is doing (otherwise it is guessed). */
  jobs?: Job[];
  /** The id of where the focus goes as the panel closes if what opened it is gone (a dialog that closed). */
  focusFallbackId?: string;
}

/**
 * "Revisión de calidad": what the automatic review of the module's AI video found, scene by scene (fixed with a change
 * to the script, seen in the video, or ignored), and the frames it looked at; it can be asked again.
 */
export function QaReportSheet({
  course,
  moduleId,
  open,
  openingKey,
  onClose,
  jobs = [],
  focusFallbackId,
}: QaReportSheetProps) {
  const reviewed = course.modules.find((each) => each.id === moduleId) ?? null;
  return (
    <Sheet open={open && reviewed !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        className="w-full sm:max-w-3xl"
        fallbackFocus={focusFallbackId ? () => document.getElementById(focusFallbackId) : undefined}
      >
        {reviewed && (
          <QaPanel key={openingKey} course={course} module={reviewed} jobs={jobs} busy={moduleActivity(reviewed, jobs)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** The id of a finding's first action («Corregir», «Ignorar» or «Reabrir»: the same button, whatever it does now). */
const actionId = (issue: Pick<ReviewIssue, "id">) => `qa-issue-${issue.id}-action`;

interface PanelProps {
  course: CourseDetail;
  module: ModuleAdmin;
  jobs: Job[];
  /** What the module is doing: while its video is produced again, the new one will bring its own review. */
  busy: ModuleActivity;
}

function QaPanel({ course, module, jobs, busy }: PanelProps) {
  const review = useVideoReview(module, course.id);
  const request = useRequestReview(course.id, module.id);
  const capabilities = useStudioCapabilities();
  // «Corregir»: a change to the script, over this panel; «Ver en el video» and an enlarged frame, over it too.
  const revisions = useRevisionSheet();
  const moment = useOpening<ReviewIssue | null>(null);
  const [framePosition, setFramePosition] = useState<number | null>(null);
  const statusHeading = useRef<HTMLHeadingElement>(null);
  const waitId = useId();
  // The scenes' titles as the script has them now (the review knows each scene by its id).
  const storyboard = useQuery({
    queryKey: studioKeys.storyboard(module.id),
    queryFn: ({ signal }) => inRenderSlot(signal, () => studioApi.storyboard(module.id, signal)),
    enabled: module.scene_count > 0,
    gcTime: 0, // the script editor's own copy (same key): never kept for it stale
    staleTime: STUDIO_STALE_MS,
  });
  const scenes = new Map((storyboard.data?.scenes ?? []).map((scene) => [scene.id, scene]));

  const data = review.data ?? null;
  // It couldn't be read: whether the video has a review isn't known (asking for one would make another, and pay for it).
  const unreadable = review.isError && review.data === undefined;
  const reviewing = isReviewing(data);
  // Asking for it (again) waits while it is being made, while the video is produced again, and without the AI.
  const wait = reviewing
    ? "La revisión está en curso: puedes cerrar este panel."
    : busy === "rendering"
      ? "El video se está produciendo de nuevo: se revisa al terminar."
      : !capabilities.ai
        ? "Sin la llave de OpenAI en el servidor no se pueden revisar los videos."
        : null;
  // Asked here: its progress takes the focus once it shows.
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    if (asked) statusHeading.current?.focus();
  }, [asked]);
  const ask = () => {
    if (wait || request.isPending) return;
    request.mutate(undefined, { onSuccess: () => setAsked((count) => count + 1) });
  };
  // One followed here ends: screen readers hear how it went.
  const [news, setNews] = useState("");
  const lastStatus = useRef(data?.status);
  useEffect(() => {
    const was = lastStatus.current;
    lastStatus.current = data?.status;
    if (!data || !reviewEnded(was, data.status)) return;
    setNews(data.status === "error" ? "No se pudo completar la revisión." : `Revisión terminada. ${foundSentence(data.issues)}`);
  }, [data]);

  const frames = data?.frames ?? [];
  const numbers = data ? sceneNumbers(data) : new Map<string, number>();
  const openFrame = (issue: ReviewIssue) => {
    const position = frames.findIndex((frame) => frame.index === issue.frame_index);
    if (position >= 0) setFramePosition(position);
  };

  return (
    <>
      <SheetHeader>
        <p className="eyebrow mb-2">Módulo {twoDigits(module.order)}</p>
        <SheetTitle className="font-display text-2xl font-medium tracking-tightest">Revisión de calidad</SheetTitle>
        <SheetDescription className="mt-1 break-words text-sm text-muted-foreground">{module.title}</SheetDescription>
      </SheetHeader>
      <p className="sr-only" aria-live="polite">
        {news}
      </p>
      <SheetBody className="space-y-8">
        {review.isPending ? (
          <Skeleton className="h-64" />
        ) : unreadable ? (
          <QueryError query={review} />
        ) : data === null ? (
          <NoReview headingRef={statusHeading} />
        ) : (
          <>
            <StatusBlock review={data} headingRef={statusHeading} />
            <IssuesSection
              course={course}
              module={module}
              review={data}
              numbers={numbers}
              scenes={scenes}
              onFix={(issue) =>
                revisions.show({
                  moduleId: module.id,
                  sceneIds: issue.scene_id ? [issue.scene_id] : [],
                  observation: issue.suggested_observation,
                  qaIssue: { id: issue.id, description: issue.description },
                })
              }
              onSee={moment.show}
              onFrame={openFrame}
            />
            {frames.length > 0 && (
              <section aria-labelledby={`qa-${module.id}-frames`} className="space-y-3">
                <SectionTitle id={`qa-${module.id}-frames`}>Fotogramas revisados ({frames.length})</SectionTitle>
                <p className="text-sm text-muted-foreground">
                  Uno de cada escena completa y otros al azar, nunca en una transición. Tócalos para verlos en grande.
                </p>
                <FrameGrid frames={frames} issues={data.issues} numbers={numbers} onOpen={setFramePosition} />
              </section>
            )}
          </>
        )}
      </SheetBody>
      {!review.isPending && !unreadable && (
        <SheetFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <p id={waitId} className="min-w-0 text-sm text-muted-foreground">
            {wait ?? "Toma fotogramas nuevos del video publicado."}
          </p>
          {/* Never `disabled` while it waits: the button just pressed would lose the focus. */}
          <Button
            variant={data ? "outline" : "accent"}
            onClick={ask}
            aria-disabled={Boolean(wait) || request.isPending || undefined}
            aria-busy={request.isPending || undefined}
            aria-describedby={waitId}
            className={cn((wait || request.isPending) && "pointer-events-none opacity-45")}
          >
            {request.isPending ? <Loader2 className="animate-spin" aria-hidden /> : data ? <RotateCcw /> : <ScanSearch />}
            {data ? "Revisar de nuevo" : "Revisar ahora"}
          </Button>
        </SheetFooter>
      )}

      <FrameDialog
        frames={frames}
        issues={data?.issues ?? []}
        numbers={numbers}
        position={framePosition}
        onPositionChange={setFramePosition}
      />
      <MomentDialog module={module} issue={moment.value} open={moment.open} onClose={moment.hide} />
      <RevisionSheet
        course={course}
        jobs={jobs}
        {...revisions.sheet}
        focusFallbackId={(asked) => (asked.qaIssue ? actionId(asked.qaIssue) : undefined)}
      />
    </>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-[11px] font-bold uppercase tracking-label text-ink-700">
      {children}
    </h3>
  );
}

type HeadingRef = Ref<HTMLHeadingElement>;

function StatusHeading({ headingRef, children }: { headingRef: HeadingRef; children: ReactNode }) {
  return (
    <h3 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-medium tracking-tightest focus-visible:ring-0">
      {children}
    </h3>
  );
}

/** The video has no review yet (made before reviews, or with them turned off in Parámetros). */
function NoReview({ headingRef }: { headingRef: HeadingRef }) {
  return (
    <div className="space-y-2">
      <StatusHeading headingRef={headingRef}>Este video aún no tiene revisión</StatusHeading>
      <p className="text-muted-foreground">
        La IA mira un fotograma de cada escena completa y otros al azar, y lee el guion contra la evaluación y los
        materiales del curso. Solo avisa: el video no cambia.
      </p>
    </div>
  );
}

/** Where the review is: being made (with its progress), failed (and why), or done (what it found, and what is open). */
function StatusBlock({ review, headingRef }: { review: VideoReview; headingRef: HeadingRef }) {
  const job = useJob(isReviewing(review) ? review.job_id : null);
  const open = review.issues.filter(isOpen);
  const critical = open.filter((issue) => issue.severity === "critical").length;
  if (isReviewing(review)) {
    return (
      <div className="space-y-4">
        <StatusHeading headingRef={headingRef}>Revisando el video</StatusHeading>
        <JobStatus job={job.data} fallback="En cola para revisar el video" className="max-w-md" />
        <p className="text-sm text-muted-foreground">
          Puedes cerrar este panel: la revisión sigue y el módulo dirá cómo salió.
          {review.issues.length > 0 && " Abajo está lo que ya encontraron las revisiones automáticas."}
        </p>
      </div>
    );
  }
  const heading =
    review.status === "error"
      ? "No se pudo completar la revisión"
      : !review.issues.length
        ? "Todo se ve bien"
        : critical
          ? "Hay problemas por corregir"
          : open.length
            ? "Hay detalles por revisar"
            : "No quedan pendientes";
  const at = review.finished_at ?? review.created_at;
  return (
    <div className="space-y-3">
      <StatusHeading headingRef={headingRef}>{heading}</StatusHeading>
      {review.status === "error" && (
        <Alert variant="destructive" role="note">
          <AlertTriangle />
          <div>
            <AlertTitle>La IA no pudo revisar los fotogramas</AlertTitle>
            <AlertDescription className="break-words">
              {review.error || "Intenta de nuevo en unos minutos."}
              {review.issues.length > 0 && " Lo que encontraron las revisiones automáticas sigue abajo."}
            </AlertDescription>
          </div>
        </Alert>
      )}
      {review.summary && <p className="break-words">{review.summary}</p>}
      {(review.status === "done" || review.issues.length > 0) && (
        <p className="text-sm text-muted-foreground">
          {foundSentence(review.issues)}{" "}
          {review.issues.length > 0 && (open.length ? pendingSentence(open.length, critical) : "Ninguno queda abierto.")}
        </p>
      )}
      {review.checks.content_error && (
        <Alert variant="warning" role="note">
          <AlertTriangle />
          <AlertDescription className="break-words">
            No se pudo revisar el contenido del guion: {review.checks.content_error}
          </AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">
        Revisado{" "}
        <time dateTime={at ?? undefined} title={formatDate(at, true)}>
          {formatRelative(at)}
        </time>
      </p>
    </div>
  );
}

interface IssuesSectionProps {
  course: CourseDetail;
  module: ModuleAdmin;
  review: VideoReview;
  numbers: Map<string, number>;
  scenes: Map<string, StoryboardScene>;
  onFix: (issue: ReviewIssue) => void;
  onSee: (issue: ReviewIssue) => void;
  onFrame: (issue: ReviewIssue) => void;
}

/** What the review found, scene by scene in the video's order (the whole video's last), the most serious first. */
function IssuesSection({ course, module, review, numbers, scenes, onFix, onSee, onFrame }: IssuesSectionProps) {
  const groups = groupIssues(review.issues, numbers);
  const titleId = `qa-${module.id}-issues`;
  if (!groups.length) return null; // nothing (yet): the status above says it
  return (
    <section aria-labelledby={titleId} className="space-y-4">
      <SectionTitle id={titleId}>Hallazgos</SectionTitle>
      {groups.map((group) => {
        const groupId = `${titleId}-${group.sceneId ?? "video"}`;
        const label = sceneLabel(group.sceneId, numbers);
        const scene = group.sceneId ? scenes.get(group.sceneId) : undefined;
        // The scene as the script names it now (a scene removed since is said so).
        const name = !group.sceneId ? null : scene ? sceneTitle(scene) : scenes.size ? "ya no está en el guion" : null;
        return (
          <div key={groupId} role="group" aria-labelledby={groupId} className="space-y-2">
            <h4 id={groupId} className="break-words font-semibold">
              {label ?? "Todo el video"}
              {name && <span className="font-normal text-muted-foreground"> · {name}</span>}
            </h4>
            <ul className="space-y-3">
              {group.issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  course={course}
                  module={module}
                  review={review}
                  issue={issue}
                  onFix={() => onFix(issue)}
                  onSee={() => onSee(issue)}
                  onFrame={() => onFrame(issue)}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

interface IssueCardProps {
  course: CourseDetail;
  module: ModuleAdmin;
  review: VideoReview;
  issue: ReviewIssue;
  onFix: () => void;
  onSee: () => void;
  onFrame: () => void;
}

/**
 * One finding: how serious, what, where and who found it, with what the admin can do: fix it with a change to the
 * script («Corregir», when one can), see it in the video, ignore it or open it again.
 */
function IssueCard({ course, module, review, issue, onFix, onSee, onFrame }: IssueCardProps) {
  const action = useIssueAction(course.id, module.id);
  const card = useRef<HTMLLIElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const textId = `qa-issue-${issue.id}`;
  const open = isOpen(issue);
  // A change to the script fixes it when the review says how to ask for it (the video's own findings: never).
  const fixable = open && Boolean(issue.suggested_observation.trim()) && module.scene_count > 0;
  const frame = issue.frame_index === null ? undefined : review.frames.find((each) => each.index === issue.frame_index);
  const seeable = issue.at_seconds !== null && Boolean(module.video);
  const saving = action.isPending;
  const act = (kind: IssueAction) => {
    if (saving) return;
    action.mutate(
      { reviewId: review.id, issueId: issue.id, action: kind },
      {
        // The button pressed may be gone (an ignored finding has no «Ignorar»): the focus stays on the finding, also when
        // it fell to what holds it (the panel). Not when it went to another finding meanwhile (ignored right after).
        onSuccess: () => {
          const focused = document.activeElement;
          if (!focused || focused.contains(card.current) || card.current?.contains(focused)) first.current?.focus();
        },
      },
    );
  };
  // No change is asked for a finding while it is being ignored.
  const fix = () => {
    if (!saving) onFix();
  };
  // The first button stays the same element whatever it does: the focus stays on it as the finding changes.
  const primary = !open
    ? { label: "Reabrir", icon: <Undo2 />, variant: "outline" as const, saves: true, run: () => act("reopen") }
    : fixable
      ? { label: "Corregir", icon: <Wrench />, variant: "accent" as const, saves: false, run: fix }
      : { label: "Ignorar", icon: <EyeOff />, variant: "outline" as const, saves: true, run: () => act("dismiss") };
  // While it saves, its buttons wait. Never `disabled`: the one pressed keeps the focus, also when saving fails.
  const waiting = cn(saving && "pointer-events-none opacity-45");
  const severity = SEVERITIES[issue.severity];
  return (
    <li
      ref={card}
      aria-labelledby={textId}
      className={cn("space-y-3 border border-border p-4", open ? "bg-white" : "bg-mist/60")}
      data-status={issue.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={severity.variant}>{severity.label}</Badge>
        <span className="text-[11px] font-bold uppercase tracking-label text-ink-700">{CATEGORIES[issue.category]}</span>
        <IssueStatusBadge issue={issue} />
        {issue.at_seconds !== null && (
          <span className="text-xs text-muted-foreground">en el {formatDuration(issue.at_seconds)}</span>
        )}
      </div>
      <div className="flex items-start gap-4">
        {frame && (
          <button
            type="button"
            onClick={onFrame}
            className="w-28 shrink-0 sm:w-36"
            aria-label={`Ver en grande el fotograma del ${formatDuration(frame.at_seconds)}`}
          >
            <FrameImage frame={frame} issues={issuesOn(frame, [issue])} />
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p id={textId} className={cn("break-words", !open && "text-muted-foreground")}>
            {issue.description}
          </p>
          <p className="text-xs text-muted-foreground">{SOURCES[issue.source]}</p>
        </div>
      </div>
      {issue.status === "fixed" && (
        <p className="text-sm text-muted-foreground">
          Se corrigió en el guion: el video lo mostrará cuando lo vuelvas a producir.
        </p>
      )}
      {open && issue.source === "video" && (
        <p className="text-sm text-muted-foreground">Un cambio al guion no lo arregla: vuelve a producir el video.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          ref={first}
          id={actionId(issue)}
          size="sm"
          variant={primary.variant}
          onClick={primary.run}
          aria-disabled={saving || undefined}
          aria-busy={(saving && primary.saves) || undefined}
          aria-describedby={textId}
          className={waiting}
        >
          {saving && primary.saves ? <Loader2 className="animate-spin" aria-hidden /> : primary.icon}
          {primary.label}
        </Button>
        {seeable && (
          <Button size="sm" variant="ghost" onClick={onSee} aria-describedby={textId}>
            <PlayCircle /> Ver en el video
          </Button>
        )}
        {fixable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => act("dismiss")}
            aria-disabled={saving || undefined}
            aria-busy={saving || undefined}
            aria-describedby={textId}
            className={waiting}
          >
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <EyeOff />} Ignorar
          </Button>
        )}
      </div>
    </li>
  );
}

interface MomentDialogProps {
  module: ModuleAdmin;
  issue: ReviewIssue | null;
  open: boolean;
  onClose: () => void;
}

/** «Ver en el video»: the module's video, at the moment the finding was seen. */
function MomentDialog({ module, issue, open, onClose }: MomentDialogProps) {
  const at = issue?.at_seconds ?? null;
  return (
    <Dialog open={open && at !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-4xl">
        {issue && at !== null && (
          <>
            <DialogHeader>
              <DialogTitle>En el video: {formatDuration(at)}</DialogTitle>
              <DialogDescription className="break-words">{issue.description}</DialogDescription>
            </DialogHeader>
            <ModuleVideo module={module} startAt={at} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
