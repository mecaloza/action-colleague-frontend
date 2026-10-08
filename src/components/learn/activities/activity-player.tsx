"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { animate, AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Play, RotateCcw, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import type {
  ActivityFinish,
  ActivityMoveResult,
  ActivityPlay,
  ActivityType,
  ActivityView,
  Language,
  LearnerActivitySummary,
} from "@/lib/api/types";
import { useReturnFocus } from "@/lib/hooks/use-return-focus";
import { toastError } from "@/lib/notify";
import { DecisionPlayer } from "./decision-player";
import { InspectionPlayer } from "./inspection-player";
import { QuickPlayer } from "./quick-player";
import { SimulatorPlayer } from "./simulator-player";
import { useNarration, type Narration } from "./use-narration";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  decision: "Decisión con cliente",
  inspection: "Inspección visual",
  simulator: "Simulador con reto",
  quick: "Reto rápido",
};

/** How a play reaches the server: the learner's endpoints, or the admin's preview (which never finishes). */
export interface ActivityApi {
  start: (untimed: boolean) => Promise<ActivityPlay>;
  move: (attemptId: number, move: Record<string, unknown>) => Promise<ActivityMoveResult>;
  finish?: (attemptId: number) => Promise<ActivityFinish>;
}

/**
 * What every kind of player gets: the play so far, a way to move, and the narrator. Players are laid out in the
 * game's scroll container, which publishes two heights: `--game-header` (its sticky header: a status bar sticks
 * right under it) and `--action-bar` (the bar at the bottom once the game is over: a bottom sheet sits above it).
 */
export interface PlayerProps<V extends ActivityView> {
  view: V;
  /** Sends a move; resolves with the server's verdict (and says its lines), or null if it failed. */
  move: (move: Record<string, unknown>) => Promise<ActivityMoveResult | null>;
  narration: Narration;
  /** Audio URLs this play has revealed so far, by line key. */
  clips: Record<string, string>;
}

function Points({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduce) return setShown(value);
    const controls = animate(shown, value, { duration: 0.6, onUpdate: (latest) => setShown(Math.round(latest)) });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- counts from what is on screen to the new score
  }, [value, reduce]);
  return <span className="tabular-nums">{shown}</span>;
}

/** The score in the header: a compact pill on phones, a label over the number from `sm` up. */
function Score({ value }: { value: number }) {
  return (
    <p className="flex shrink-0 items-baseline gap-1 rounded-full bg-white/10 px-3 py-1 sm:block sm:rounded-none sm:bg-transparent sm:p-0 sm:text-right">
      <span className="hidden text-[11px] font-bold uppercase tracking-label text-white/50 sm:block">Puntos</span>
      <span className="font-display text-lg font-semibold leading-none text-accent sm:text-2xl sm:leading-tight" aria-hidden>
        <Points value={value} />
      </span>
      <span className="text-xs font-semibold text-white/60 sm:hidden" aria-hidden>
        pts
      </span>
      <span className="sr-only" aria-live="polite">
        {value} puntos
      </span>
    </p>
  );
}

/** A callback ref, and the height of the element it is on (0 while there is none). */
function useHeight<T extends HTMLElement>(): [(node: T | null) => void, number] {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) {
      setHeight(0);
      return;
    }
    observer.current = new ResizeObserver(() => setHeight(node.getBoundingClientRect().height));
    observer.current.observe(node);
  }, []);
  return [ref, height];
}

/** Whether the play had a move: a game over without any (a clock that ran out untouched) is not worth keeping. */
function hasMoves(view: ActivityView): boolean {
  switch (view.type) {
    case "decision":
      return view.path.length > 0;
    case "inspection":
      return view.items.some((item) => item.chosen !== null);
    case "simulator":
      return view.tries > 0;
    case "quick":
      return view.solved > 0 || view.mistakes > 0;
  }
}

const QUICK_FINISH_RETRY_MS = 1500; // the server's clock may run out a moment after the learner's

async function finishPlay(finish: NonNullable<ActivityApi["finish"]>, attemptId: number, quick: boolean) {
  try {
    return await finish(attemptId);
  } catch (error) {
    if (!(quick && error instanceof ApiError && error.status === 409)) throw error;
    await new Promise((resolve) => window.setTimeout(resolve, QUICK_FINISH_RETRY_MS));
    return finish(attemptId);
  }
}

interface ActivityPlayerProps {
  /** `resumable`: an open play is waiting, so "Empezar" becomes "Continuar partida". */
  activity: Pick<LearnerActivitySummary, "id" | "type" | "title" | "intro" | "max_score"> &
    Partial<Pick<LearnerActivitySummary, "resumable">>;
  api: ActivityApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A play's result. Also after the player closed: a game over whose result wasn't asked for is recorded then. */
  onFinished?: (result: ActivityFinish) => void;
  /** Recording that game over as the player closed failed (the learner was told): what shows the play may be stale. */
  onRecordFailed?: () => void;
  /** Offer playing a quick challenge without its clock (the admin's preview always plays it timed). */
  allowUntimed?: boolean;
  /** The course's language: the simulator writes its numbers (and money) as its readers do. */
  language?: Language;
}

/** A play of one activity, full screen: an intro, the game itself, and its result. */
export function ActivityPlayer({
  activity,
  api,
  open,
  onOpenChange,
  onFinished,
  onRecordFailed,
  allowUntimed = true,
  language = "es",
}: ActivityPlayerProps) {
  const narration = useNarration();
  const focus = useReturnFocus();
  // Answers that arrive after the player closed change nothing (and say nothing).
  const alive = useRef(true);
  useEffect(() => {
    // Set on mount too: StrictMode mounts, unmounts and mounts again.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [play, setPlay] = useState<ActivityPlay | null>(null);
  const [view, setView] = useState<ActivityView | null>(null);
  const [clips, setClips] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [untimed, setUntimed] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<ActivityFinish | null>(null);
  // Whether starting picks up an open play: what the course said as the player opened; false once a play is on.
  const [resumable, setResumable] = useState(Boolean(activity.resumable));
  const moved = useRef(false);
  // The play's finish, asked once: by "Ver resultado", or as the player closes on a game that is over.
  const recording = useRef<Promise<ActivityFinish> | null>(null);
  const [headerRef, headerHeight] = useHeight<HTMLElement>();
  const [barRef, barHeight] = useHeight<HTMLDivElement>();
  const resultButton = useRef<HTMLButtonElement>(null);
  const over = Boolean(view?.done) && !result;

  // The game just ended: its one way on, "Ver resultado" (always in sight at the bottom), takes the focus.
  useEffect(() => {
    if (over) resultButton.current?.focus({ preventScroll: true });
  }, [over]);

  const start = async () => {
    narration.unlock(); // inside the tap, before the request: iOS then plays the lines said after it
    setStarting(true);
    try {
      const started = await api.start(untimed);
      if (!alive.current) return;
      recording.current = null;
      moved.current = hasMoves(started.view);
      setPlay(started);
      setView(started.view);
      setClips(started.narration);
      setResult(null);
      if (Boolean(started.resumed) !== resumable) {
        // The course was out of date (another tab, or a clock that ran out meanwhile): say what happened.
        toast(started.resumed ? "Retomamos la partida que tenías abierta." : "Tu partida anterior ya terminó: empieza una nueva.");
      }
      setResumable(false);
      // A resumed play goes straight to where it was, without the intro.
      const firstLine = started.view.type === "decision" ? started.view.node?.line : undefined;
      narration.say([
        started.resumed ? undefined : started.narration.intro,
        firstLine ? started.narration[firstLine] : undefined,
      ]);
    } catch (error) {
      toastError(error);
    } finally {
      setStarting(false);
    }
  };

  const move = async (body: Record<string, unknown>) => {
    if (!play || !view) return null;
    try {
      const outcome = await api.move(play.attempt_id, body);
      if (!alive.current) return null;
      moved.current = true;
      setClips((known) => ({ ...known, ...outcome.narration }));
      // A game over stays over: a late answer to a tap sent as the clock ran out doesn't reopen it.
      setView((current) =>
        current
          ? ({ ...current, score: outcome.result.score, done: current.done || outcome.done } as ActivityView)
          : current,
      );
      return outcome;
    } catch (error) {
      if (!alive.current) return null;
      toastError(error);
      if (error instanceof ApiError && error.status === 409) {
        setPlay(null); // edited or over meanwhile: back to the start
        setView(null);
      }
      return null;
    }
  };

  /** Records the play, once. Its result reaches `onFinished` even if the player closed meanwhile. */
  const record = () => {
    const finish = api.finish;
    if (!play || !view || !finish) return null;
    if (!recording.current) {
      recording.current = finishPlay(finish, play.attempt_id, view.type === "quick").then(
        (finished) => {
          onFinished?.(finished);
          return finished;
        },
        (error: unknown) => {
          recording.current = null; // "Ver resultado" can try again
          throw error;
        },
      );
    }
    return recording.current;
  };

  const showResult = async () => {
    if (!view) return;
    const recorded = record();
    if (!recorded) {
      // The admin's preview keeps nothing: its score, as played.
      setResult({
        score: view.score,
        max_score: view.max_score,
        module_completed: false,
        next_module_id: null,
        course_completed: false,
      });
      return;
    }
    setFinishing(true);
    try {
      const finished = await recorded;
      if (alive.current) setResult(finished);
    } catch (error) {
      if (alive.current) toastError(error);
    } finally {
      if (alive.current) setFinishing(false);
    }
  };

  const close = () => {
    narration.say([]);
    // A game over whose result wasn't asked for still counts: recorded as it closes (its module and course follow).
    // If that fails the learner hears it, and whoever shows the play refreshes it: the server may have counted it.
    if (over && moved.current) {
      void record()?.catch((error: unknown) => {
        toastError(error);
        onRecordFailed?.();
      });
    }
    onOpenChange(false);
  };

  const restart = () => {
    recording.current = null;
    setPlay(null);
    setView(null);
    setResult(null);
    setClips({});
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/80" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex scroll-pb-[var(--action-bar)] scroll-pt-[var(--game-header)] flex-col overflow-y-auto overflow-x-hidden overscroll-contain bg-ink-950 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-white outline-none sm:inset-4 sm:rounded-sm"
          style={{ "--game-header": `${headerHeight}px`, "--action-bar": `${barHeight}px` } as CSSProperties}
          aria-describedby={undefined}
          {...focus}
        >
          <header
            ref={headerRef}
            className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-ink-950/95 px-4 py-2 backdrop-blur sm:gap-4 sm:px-5 sm:py-4"
          >
            <LogoMark className="hidden h-7 w-7 shrink-0 text-accent sm:block" />
            <div className="min-w-0 flex-1">
              <p className="eyebrow hidden text-white/50 sm:flex">{ACTIVITY_LABELS[activity.type]}</p>
              <DialogPrimitive.Title className="line-clamp-2 font-display text-base font-medium leading-snug sm:text-lg">
                {activity.title}
              </DialogPrimitive.Title>
            </div>
            {view && <Score value={view.score} />}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-white hover:bg-white/10"
              onClick={narration.toggleMuted}
              aria-pressed={narration.muted}
              aria-label={narration.muted ? "Activar la voz" : "Silenciar la voz"}
            >
              {narration.muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-white hover:bg-white/10"
                aria-label="Cerrar actividad"
              >
                <X />
              </Button>
            </DialogPrimitive.Close>
          </header>

          {/* On a phone the game runs under the home indicator: the last choice or card stays above it. */}
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:py-8">
            <AnimatePresence mode="wait">
              {result ? (
                <Result key="result" result={result} onAgain={restart} onClose={close} />
              ) : view ? (
                <motion.div
                  key="play"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 flex-col"
                >
                  {view.type === "decision" && (
                    <DecisionPlayer view={view} move={move} narration={narration} clips={clips} />
                  )}
                  {view.type === "inspection" && (
                    <InspectionPlayer
                      view={view}
                      move={move}
                      narration={narration}
                      clips={clips}
                      imageUrl={play?.image_url ?? null}
                    />
                  )}
                  {view.type === "simulator" && (
                    <SimulatorPlayer view={view} move={move} narration={narration} clips={clips} language={language} />
                  )}
                  {view.type === "quick" && (
                    <QuickPlayer
                      view={view}
                      move={move}
                      narration={narration}
                      clips={clips}
                      onTimeUp={() => setView((current) => (current ? { ...current, done: true } : current))}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="m-auto flex max-w-xl flex-col items-center gap-5 text-center sm:gap-6"
                >
                  <LogoMark className="h-14 w-14 text-accent sm:h-16 sm:w-16" strokeWidth={3} />
                  <p className="eyebrow text-white/50">{ACTIVITY_LABELS[activity.type]}</p>
                  <p className="display-md text-balance text-white" aria-hidden>
                    {activity.title}
                  </p>
                  {activity.intro && <p className="text-lg text-white/70">{activity.intro}</p>}
                  <p className="text-sm text-white/50">
                    {resumable
                      ? "Tienes una partida sin terminar: sigue donde la dejaste."
                      : `Hasta ${activity.max_score} puntos · con voz (puedes silenciarla)`}
                  </p>
                  {/* Untimed is a choice for a new play: one already on keeps its clock. */}
                  {!resumable && activity.type === "quick" && allowUntimed && (
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 text-left text-sm text-white/70">
                      <input
                        type="checkbox"
                        className="h-6 w-6 shrink-0 cursor-pointer accent-accent"
                        checked={untimed}
                        onChange={(event) => setUntimed(event.target.checked)}
                      />
                      Jugar sin límite de tiempo (sin bonus por tiempo)
                    </label>
                  )}
                  <Button variant="accent" size="lg" onClick={() => void start()} loading={starting}>
                    <Play /> {resumable ? "Continuar partida" : "Empezar"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Once the game is over its way on stays at the bottom of the screen, wherever the learner scrolled. */}
          {over && (
            <div
              ref={barRef}
              className="sticky bottom-0 z-20 border-t border-white/10 bg-ink-950/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6"
            >
              <div className="mx-auto flex max-w-4xl justify-center">
                <Button
                  ref={resultButton}
                  variant="accent"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => void showResult()}
                  loading={finishing}
                >
                  <Trophy /> Ver resultado
                </Button>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Result({ result, onAgain, onClose }: { result: ActivityFinish; onAgain: () => void; onClose: () => void }) {
  const share = result.max_score ? result.score / result.max_score : 0;
  const verdict = share >= 0.8 ? "¡Excelente!" : share >= 0.5 ? "¡Bien hecho!" : "Sigue practicando";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="m-auto flex max-w-xl flex-col items-center gap-5 text-center"
      role="status"
    >
      <Trophy className="h-14 w-14 text-accent" />
      <p className="display-md text-white">{verdict}</p>
      <p className="font-display text-5xl font-semibold text-accent">
        <span aria-hidden>
          <Points value={result.score} />
          <span className="text-2xl text-white/50"> / {result.max_score}</span>
        </span>
        <span className="sr-only">
          {result.score} de {result.max_score} puntos
        </span>
      </p>
      {result.module_completed && <p className="text-white/70">Completaste el módulo.</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline-inverse" onClick={onAgain}>
          <RotateCcw /> Jugar de nuevo
        </Button>
        <Button variant="accent" onClick={onClose}>
          Continuar
        </Button>
      </div>
    </motion.div>
  );
}
