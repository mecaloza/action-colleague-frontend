"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { twoDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STEPS, type StepId, stepIndex } from "./steps";

interface StudioStepperProps {
  current: StepId;
  /** The furthest step the course has reached: steps up to it can be revisited. */
  reached: StepId;
  onSelect: (step: StepId) => void;
}

/** Numbered steps of the AI studio; done steps show a check, future ones are not clickable yet. */
export function StudioStepper({ current, reached, onSelect }: StudioStepperProps) {
  const reachedIndex = stepIndex(reached);
  const nav = useRef<HTMLElement>(null);
  // On a phone the steps scroll sideways: the one on screen is kept in view (without scrolling the page).
  useEffect(() => {
    const container = nav.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!container || !active || container.scrollWidth <= container.clientWidth) return;
    container.scrollLeft = active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2;
  }, [current]);
  return (
    <nav ref={nav} aria-label="Pasos del estudio" className="scrollbar-thin relative -mx-4 overflow-x-auto px-4">
      <ol className="flex min-w-max gap-2 md:grid md:min-w-0 md:grid-cols-5">
        {STEPS.map((step, index) => {
          const active = step.id === current;
          const done = index < reachedIndex;
          const available = index <= reachedIndex;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                disabled={!available}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex w-44 flex-col items-start gap-2 border-t-2 pt-4 text-left transition-colors md:w-full",
                  active ? "border-accent" : done ? "border-white/60 hover:border-white" : "border-white/15",
                  !available && "cursor-not-allowed",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-display text-2xl font-medium leading-none",
                      active ? "text-accent" : available ? "text-white" : "text-white/30",
                    )}
                  >
                    {twoDigits(index + 1)}
                  </span>
                  {done && !active && <Check className="h-4 w-4 text-accent" aria-label="Listo" />}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-label",
                    active || available ? "text-white" : "text-white/40",
                  )}
                >
                  {step.label}
                </span>
                <span className={cn("text-xs", available ? "text-white/60" : "text-white/30")}>{step.hint}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
