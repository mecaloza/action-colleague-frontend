"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flame, Timer } from "lucide-react";
import type { QuickCard, QuickView } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./activity-player";

interface QuickResult {
  correct: boolean;
  repeated?: boolean;
  streak: number;
  bonus?: number;
  time_bonus?: number;
  timeout?: boolean;
}

interface TileOptions {
  onClick: () => void;
  /** Match mode, a concept: whether it is the one picked, waiting for its pair. */
  active?: boolean;
  disabled?: boolean;
  /** Order mode: the place this step took in the learner's order. */
  step?: number;
}

/** Match pairs, or tap the steps in order, before the time runs out. */
export function QuickPlayer({ view, move, onTimeUp }: PlayerProps<QuickView> & { onTimeUp: () => void }) {
  const reduce = useReducedMotion();
  const orderTitle = useId();
  const [cards, setCards] = useState<QuickCard[]>(view.cards);
  const [answers, setAnswers] = useState<QuickCard[]>(view.answers);
  const [placed, setPlaced] = useState<string[]>(view.placed);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [streak, setStreak] = useState(view.streak);
  // The bonus of a right answer: floats over the status bar and fades, so the cards below never move.
  const [gain, setGain] = useState<{ key: number; text: string } | null>(null);
  // What a screen reader hears after each answer.
  const [announcement, setAnnouncement] = useState("");
  // An answer tapped before a concept: the hint says what to do first (the count replays its shake).
  const [nudges, setNudges] = useState(0);
  // Whole seconds, rounded up: the clock never shows zero (nor ends) before the server's does.
  const [left, setLeft] = useState(view.remaining === null ? null : Math.ceil(view.remaining));
  const [timedOut, setTimedOut] = useState(false);
  // The pair (or step) on its way to the server: marked, and no other one goes until its answer comes back.
  const [pending, setPending] = useState<{ card: string; answer?: string } | null>(null);
  const over = view.done || left === 0;

  useEffect(() => {
    if (left === null || view.done) return;
    const ends = Date.now() + left * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        setAnnouncement("Se acabó el tiempo.");
        onTimeUp();
      }
    }, 250);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one clock per play, counted from the server's time left
  }, [view.done]);

  const solve = (token: string, list: "cards" | "answers") =>
    (list === "cards" ? setCards : setAnswers)((items) =>
      items.map((item) => (item.token === token ? { ...item, solved: true } : item)),
    );

  const send = async (card: string, answer?: string) => {
    if (pending || over) return;
    setPending({ card, answer });
    const outcome = await move(answer ? { card, answer } : { card });
    setPending(null);
    // A concept picked while this pair was on its way stays picked.
    setSelected((current) => (current === card ? null : current));
    if (!outcome) return;
    const result = outcome.result as unknown as QuickResult;
    setStreak(result.streak ?? 0);
    if (result.correct) {
      if (result.repeated) return;
      solve(card, "cards");
      if (answer) solve(answer, "answers");
      else setPlaced((steps) => [...steps, cards.find((item) => item.token === card)?.text ?? ""]);
      const bonus = result.time_bonus ? `+${result.time_bonus} por tiempo` : result.bonus ? `Racha +${result.bonus}` : "";
      if (bonus) setGain({ key: Date.now(), text: bonus });
      setAnnouncement(`Correcto.${bonus ? ` ${bonus}.` : ""}${outcome.done ? " ¡Completaste el reto!" : ""}`);
    } else {
      setWrong(answer ?? card);
      window.setTimeout(() => setWrong(null), 500);
      if (result.timeout) setTimedOut(true);
      setAnnouncement(result.timeout ? "Se acabó el tiempo." : "Incorrecto.");
    }
  };

  const pick = (token: string) => {
    setSelected(token);
    setNudges(0);
  };

  const pair = (answer: string) => {
    if (!selected) {
      setNudges((count) => count + 1);
      setAnnouncement("Primero toca un concepto.");
      return;
    }
    void send(selected, answer);
  };

  const tile = (item: QuickCard, { onClick, active, disabled = false, step }: TileOptions) => {
    const busy = pending?.card === item.token || pending?.answer === item.token;
    return (
      <motion.button
        key={item.token}
        type="button"
        onClick={onClick}
        disabled={item.solved || over || disabled}
        // Back to its place once the shake is over (a shake cut short would leave the card off its spot).
        animate={{ x: wrong === item.token && !reduce ? [0, -6, 6, -4, 4, 0] : 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          "flex min-h-12 items-center gap-3 border px-4 py-3 text-left text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          item.solved ? "border-success bg-success/15 text-white/70" : "border-white/25 hover:border-white/60",
          active && "border-accent bg-accent/15",
          busy && "border-accent bg-accent/10 motion-safe:animate-pulse",
          wrong === item.token && "border-destructive bg-destructive/15",
        )}
        aria-pressed={active}
        aria-busy={busy || undefined}
      >
        {step !== undefined && (
          <span className="flex h-6 min-w-6 shrink-0 items-center justify-center bg-success px-1 text-xs font-bold text-white">
            <span aria-hidden>{step}</span>
            <span className="sr-only">Paso {step}: </span>
          </span>
        )}
        <span className="min-w-0 break-words">{item.text}</span>
      </motion.button>
    );
  };

  const placeOf = (item: QuickCard) => (item.solved ? placed.indexOf(item.text) + 1 || undefined : undefined);
  const timeUp = timedOut || left === 0;
  // Above the cards (never below the fold): what to do, or how it ended.
  const [hint, hintTone] = over
    ? timeUp
      ? ["Se acabó el tiempo.", "font-semibold text-destructive"]
      : ["¡Completaste el reto!", "font-semibold text-white"]
    : view.mode === "order"
      ? ["Toca el siguiente paso.", "text-white/60"]
      : nudges
        ? ["Primero toca un concepto de la izquierda.", "font-semibold text-accent"]
        : ["Toca un concepto y luego su pareja.", "text-white/60"];

  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <p className="text-lg text-white">{view.prompt}</p>
      {/* The clock and the streak stay in sight under the header while the learner scrolls the cards. */}
      <div className="sticky top-[var(--game-header,0px)] z-10 -mx-4 flex items-center gap-4 bg-ink-950/95 px-4 py-2 text-sm backdrop-blur sm:-mx-6 sm:px-6">
        <span className="flex items-center gap-1 text-accent">
          <Flame className="h-4 w-4" /> Racha {streak}
        </span>
        {left !== null && (
          <span
            className={cn("flex items-center gap-1 tabular-nums", left <= 10 ? "text-destructive" : "text-white")}
            role="timer"
            aria-live="off"
          >
            <Timer className="h-4 w-4" /> {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
        )}
        <AnimatePresence>
          {gain && (
            <motion.span
              key={gain.key}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : 1.4 }}
              className="pointer-events-none absolute right-4 top-2 font-semibold text-accent sm:right-6"
              aria-hidden
            >
              {gain.text}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <motion.p
        key={nudges} // each answer tapped too early shakes it again
        initial={nudges ? { x: 0 } : false}
        animate={{ x: nudges && !reduce ? [0, -4, 4, -2, 2, 0] : 0 }}
        transition={{ duration: 0.4 }}
        className={cn("text-sm", hintTone)}
      >
        {hint}
      </motion.p>

      {view.mode === "match" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-3" role="group" aria-label="Conceptos">
            {cards.map((item) =>
              tile(item, {
                onClick: () => pick(item.token),
                active: selected === item.token,
                disabled: pending?.card === item.token,
              }),
            )}
          </div>
          <div className="flex flex-col gap-3" role="group" aria-label="Parejas">
            {answers.map((item) => tile(item, { onClick: () => pair(item.token), disabled: Boolean(pending) }))}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-3" role="group" aria-label="Pasos">
            {cards.map((item) =>
              tile(item, { onClick: () => void send(item.token), disabled: Boolean(pending), step: placeOf(item) }),
            )}
          </div>
          {/* The order so far, in sequence, beside the steps: on a phone each placed step shows its number instead. */}
          <div className="hidden flex-col gap-2 md:flex">
            <p id={orderTitle} className="eyebrow text-white/50">
              Tu orden
            </p>
            <ol className="flex flex-col gap-2" aria-labelledby={orderTitle}>
              {placed.map((step, index) => (
                <li key={index} className="border-l-2 border-success bg-success/10 px-4 py-2 text-white">
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
