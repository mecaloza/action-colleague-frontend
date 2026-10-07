"use client";

import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { animate, AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  LearnerActivitySummary,
} from "@/lib/api/types";
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

/** What every kind of player gets: the play so far, a way to move, and the narrator. */
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

interface ActivityPlayerProps {
  activity: Pick<LearnerActivitySummary, "id" | "type" | "title" | "intro" | "max_score">;
  api: ActivityApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished?: (result: ActivityFinish) => void;
  /** Offer playing a quick challenge without its clock (the admin's preview always plays it timed). */
  allowUntimed?: boolean;
}

const QUICK_FINISH_RETRY_MS = 1500; // the server's clock may run out a moment after the learner's

/** A play of one activity, full screen: an intro, the game itself, and its result. */
export function ActivityPlayer({
  activity,
  api,
  open,
  onOpenChange,
  onFinished,
  allowUntimed = true,
}: ActivityPlayerProps) {
  const narration = useNarration();
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

  const start = async () => {
    setStarting(true);
    try {
      const started = await api.start(untimed);
      if (!alive.current) return;
      setPlay(started);
      setView(started.view);
      setClips(started.narration);
      setResult(null);
      // Said after the learner's tap: browsers allow sound from here on.
      const firstLine = started.view.type === "decision" ? started.view.node?.line : undefined;
      narration.say([started.narration.intro, firstLine ? started.narration[firstLine] : undefined]);
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
      setClips((known) => ({ ...known, ...outcome.narration }));
      setView((current) =>
        current ? ({ ...current, score: outcome.result.score, done: outcome.done } as ActivityView) : current,
      );
      return outcome;
    } catch (error) {
      toastError(error);
      if (error instanceof ApiError && error.status === 409) {
        setPlay(null); // edited or over meanwhile: back to the start
        setView(null);
      }
      return null;
    }
  };

  const finish = async () => {
    if (!play || !view) return;
    if (!api.finish) {
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
      let finished: ActivityFinish;
      try {
        finished = await api.finish(play.attempt_id);
      } catch (error) {
        if (!(view.type === "quick" && error instanceof ApiError && error.status === 409)) throw error;
        await new Promise((resolve) => window.setTimeout(resolve, QUICK_FINISH_RETRY_MS));
        finished = await api.finish(play.attempt_id);
      }
      if (!alive.current) return;
      setResult(finished);
      onFinished?.(finished);
    } catch (error) {
      if (alive.current) toastError(error);
    } finally {
      if (alive.current) setFinishing(false);
    }
  };

  const restart = () => {
    setPlay(null);
    setView(null);
    setResult(null);
    setClips({});
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) narration.say([]);
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/80" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink-950 text-white outline-none sm:inset-4 sm:rounded-sm"
          aria-describedby={undefined}
        >
          <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-white/10 bg-ink-950/95 px-5 py-4 backdrop-blur">
            <LogoMark className="h-7 w-7 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-white/50">{ACTIVITY_LABELS[activity.type]}</p>
              <DialogPrimitive.Title className="truncate font-display text-lg font-medium">
                {activity.title}
              </DialogPrimitive.Title>
            </div>
            {view && (
              <p className="text-right">
                <span className="block text-[10px] font-bold uppercase tracking-label text-white/50">Puntos</span>
                <span className="font-display text-2xl font-semibold text-accent" aria-hidden>
                  <Points value={view.score} />
                </span>
                <span className="sr-only" aria-live="polite">
                  {view.score} puntos
                </span>
              </p>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10"
              onClick={narration.toggleMuted}
              aria-pressed={narration.muted}
              aria-label={narration.muted ? "Activar la voz" : "Silenciar la voz"}
            >
              {narration.muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10"
                aria-label="Cerrar actividad"
              >
                <X />
              </Button>
            </DialogPrimitive.Close>
          </header>

          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8">
            <AnimatePresence mode="wait">
              {result ? (
                <Result key="result" result={result} onAgain={restart} onClose={() => onOpenChange(false)} />
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
                    <SimulatorPlayer view={view} move={move} narration={narration} clips={clips} />
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
                  {view.done && (
                    <div className="mt-8 flex justify-center">
                      <Button variant="accent" size="lg" onClick={finish} loading={finishing}>
                        <Trophy /> Ver resultado
                      </Button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="m-auto flex max-w-xl flex-col items-center gap-6 text-center"
                >
                  <LogoMark className="h-16 w-16 text-accent" strokeWidth={3} />
                  <p className="display-md text-balance text-white" aria-hidden>
                    {activity.title}
                  </p>
                  {activity.intro && <p className="text-lg text-white/70">{activity.intro}</p>}
                  <p className="text-sm text-white/50">
                    Hasta {activity.max_score} puntos · con voz (puedes silenciarla)
                  </p>
                  {activity.type === "quick" && allowUntimed && (
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      <input type="checkbox" checked={untimed} onChange={(event) => setUntimed(event.target.checked)} />
                      Jugar sin límite de tiempo (sin bonus por tiempo)
                    </label>
                  )}
                  <Button variant="accent" size="lg" onClick={start} loading={starting}>
                    <Play /> Empezar
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
