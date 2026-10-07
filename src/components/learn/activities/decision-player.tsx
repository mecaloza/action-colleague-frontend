"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MessageSquareQuote, UserRound } from "lucide-react";
import type { DecisionNode, DecisionStep, DecisionView } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./activity-player";

/** A conversation with a client: their situation, the learner's choice, and its consequence, step by step. */
export function DecisionPlayer({ view, move, narration }: PlayerProps<DecisionView>) {
  const reduce = useReducedMotion();
  const [steps, setSteps] = useState<DecisionStep[]>(view.path);
  const [node, setNode] = useState<DecisionNode | null>(view.node);
  const [sending, setSending] = useState<string | null>(null);
  const latest = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latest.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [steps.length, node, reduce]);

  const choose = async (token: string) => {
    if (!node || sending) return;
    setSending(token);
    const outcome = await move({ choice: token });
    setSending(null);
    if (!outcome) return;
    const result = outcome.result as unknown as DecisionStep & { next: DecisionNode | null };
    setSteps((done) => [
      ...done,
      {
        situation: node.situation,
        choice: result.choice,
        feedback: result.feedback,
        points: result.points,
        line: result.line,
      },
    ]);
    setNode(result.next);
    narration.say([outcome.narration[result.line], result.next ? outcome.narration[result.next.line] : undefined]);
  };

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      {steps.map((step, index) => (
        <div key={index} className="flex flex-col gap-3">
          <Bubble speaker="Cliente" text={step.situation} />
          <p className="max-w-[85%] self-end border border-white/20 bg-white/5 px-4 py-3 text-right text-white/90">
            {step.choice}
          </p>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-start gap-3 border-l-2 px-4 py-3",
              step.points >= 6
                ? "border-success bg-success/10"
                : step.points >= 3
                  ? "border-warning bg-warning/10"
                  : "border-destructive bg-destructive/10",
            )}
          >
            <MessageSquareQuote className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
            <div className="flex-1">
              <p className="text-white/90">{step.feedback}</p>
              <p className="mt-1 text-sm font-semibold text-accent">+{step.points} puntos</p>
            </div>
          </motion.div>
        </div>
      ))}

      {node && (
        <motion.div
          key={node.line}
          ref={latest}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <Bubble speaker={node.speaker} text={node.situation} />
          <p className="eyebrow text-white/50">¿Qué haces?</p>
          <div className="grid gap-3">
            {node.choices.map((choice) => (
              <button
                key={choice.token}
                type="button"
                onClick={() => choose(choice.token)}
                disabled={Boolean(sending)}
                className={cn(
                  "border border-white/25 px-5 py-4 text-left text-white transition-colors hover:border-accent hover:bg-accent/10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
                  sending === choice.token && "border-accent bg-accent/15",
                )}
              >
                {choice.text}
              </button>
            ))}
          </div>
        </motion.div>
      )}
      {!node && <div ref={latest} />}
    </div>
  );
}

function Bubble({ speaker, text }: { speaker: string; text: string }) {
  return (
    <div className="flex max-w-[85%] items-start gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent"
        aria-hidden
      >
        <UserRound className="h-5 w-5" />
      </span>
      <div className="bg-white/10 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-label text-white/50">{speaker}</p>
        <p className="mt-1 text-lg text-white">{text}</p>
      </div>
    </div>
  );
}
