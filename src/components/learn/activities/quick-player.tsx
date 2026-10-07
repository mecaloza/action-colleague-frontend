"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, Timer } from "lucide-react";
import type { QuickCard, QuickView } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./activity-player";

interface QuickResult {
  correct: boolean;
  streak: number;
  bonus?: number;
  time_bonus?: number;
  timeout?: boolean;
}

/** Match pairs, or tap the steps in order, before the time runs out. */
export function QuickPlayer({ view, move, onTimeUp }: PlayerProps<QuickView> & { onTimeUp: () => void }) {
  const reduce = useReducedMotion();
  const [cards, setCards] = useState<QuickCard[]>(view.cards);
  const [answers, setAnswers] = useState<QuickCard[]>(view.answers);
  const [placed, setPlaced] = useState<string[]>(view.placed);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [streak, setStreak] = useState(view.streak);
  const [bonus, setBonus] = useState<string | null>(null);
  const [left, setLeft] = useState(view.remaining);
  const [sending, setSending] = useState(false);
  const over = view.done || left === 0;

  useEffect(() => {
    if (left === null || view.done) return;
    const ends = Date.now() + left * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((ends - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
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
    if (sending || over) return;
    setSending(true);
    const outcome = await move(answer ? { card, answer } : { card });
    setSending(false);
    setSelected(null);
    if (!outcome) return;
    const result = outcome.result as unknown as QuickResult;
    setStreak(result.streak ?? 0);
    if (result.correct) {
      solve(card, "cards");
      if (answer) solve(answer, "answers");
      else setPlaced((steps) => [...steps, cards.find((item) => item.token === card)?.text ?? ""]);
      setBonus(result.time_bonus ? `+${result.time_bonus} por tiempo` : result.bonus ? `Racha +${result.bonus}` : null);
    } else {
      setWrong(answer ?? card);
      window.setTimeout(() => setWrong(null), 500);
    }
  };

  const tile = (item: QuickCard, active: boolean, onClick: () => void) => (
    <motion.button
      key={item.token}
      type="button"
      onClick={onClick}
      disabled={item.solved || over}
      animate={wrong === item.token && !reduce ? { x: [0, -6, 6, -4, 4, 0] } : {}}
      className={cn(
        "border px-4 py-3 text-left text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        item.solved ? "border-success bg-success/15 text-white/70" : "border-white/25 hover:border-accent",
        active && "border-accent bg-accent/15",
        wrong === item.token && "border-destructive bg-destructive/15",
      )}
      aria-pressed={active}
    >
      {item.text}
    </motion.button>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg text-white">{view.prompt}</p>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-accent" aria-live="polite">
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
        </div>
      </div>
      {bonus && (
        <p className="text-sm font-semibold text-accent" aria-live="polite">
          {bonus}
        </p>
      )}
      {left === 0 && !view.done && <p className="font-semibold text-destructive">Se acabó el tiempo.</p>}

      {view.mode === "match" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-3">
            {cards.map((item) => tile(item, selected === item.token, () => setSelected(item.token)))}
          </div>
          <div className="flex flex-col gap-3">
            {answers.map((item) => tile(item, false, () => selected && send(selected, item.token)))}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-white/50">Toca el siguiente paso</p>
            {cards.map((item) => tile(item, false, () => send(item.token)))}
          </div>
          <ol className="flex flex-col gap-2">
            <p className="eyebrow text-white/50">Tu orden</p>
            {placed.map((step, index) => (
              <li key={step} className="border-l-2 border-success bg-success/10 px-4 py-2 text-white">
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      )}
      {view.mode === "match" && <p className="text-xs text-white/50">Toca un concepto y luego su pareja.</p>}
    </div>
  );
}
