"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, CircleX, FlaskConical, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SimulatorTarget, SimulatorTry, SimulatorVariable, SimulatorView } from "@/lib/api/types";
import { computeFormula } from "@/lib/formula";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./activity-player";

function format(value: number, decimals: number): string {
  return value.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Decimals a control's values need (a step of 0.5 shows one). */
function stepDecimals(step: number): number {
  const text = String(step);
  return text.includes(".") ? Math.min(4, text.split(".")[1].length) : 0;
}

/** The value as the server will read it: on the control's steps, counted from its minimum (same float math). */
function onStep(variable: SimulatorVariable, raw: number): number {
  const steps = Math.round((Math.min(Math.max(raw, variable.min), variable.max) - variable.min) / variable.step);
  return Math.min(variable.max, variable.min + steps * variable.step);
}

function targetText(target: SimulatorTarget, decimals: number, unit: string): string {
  const suffix = unit ? ` ${unit}` : "";
  if (target.op === "lte") return `${format(target.value, decimals)}${suffix} o menos`;
  if (target.op === "gte") return `${format(target.value, decimals)}${suffix} o más`;
  return `entre ${format(target.value, decimals)} y ${format(target.value2, decimals)}${suffix}`;
}

function meets(target: SimulatorTarget, result: number): boolean {
  if (target.op === "lte") return result <= target.value;
  if (target.op === "gte") return result >= target.value;
  return target.value <= result && result <= target.value2;
}

/** Move the controls until the result meets the target; each try is checked by the server. */
export function SimulatorPlayer({ view, move, narration }: PlayerProps<SimulatorView>) {
  const reduce = useReducedMotion();
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      view.variables.map((variable) => [variable.key, view.last?.values[variable.key] ?? variable.default]),
    ),
  );
  const [tries, setTries] = useState(view.tries);
  const [last, setLast] = useState<(SimulatorTry & { text?: string }) | null>(view.last);
  const [sending, setSending] = useState(false);
  const live = computeFormula(
    view.formula,
    Object.fromEntries(view.variables.map((variable) => [variable.key, onStep(variable, values[variable.key])])),
  );
  const { decimals, unit, label } = view.output;
  const over = view.done;

  const submit = async () => {
    setSending(true);
    const outcome = await move({ values });
    setSending(false);
    if (!outcome) return;
    const result = outcome.result as unknown as SimulatorTry & { tries: number; text: string; line: string };
    setTries(result.tries);
    setLast(result);
    setValues(result.values); // as the server read them (inside each control's range and steps)
    narration.say([outcome.narration[result.line]]);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-center gap-2 text-lg text-white">
        <FlaskConical className="h-5 w-5 text-accent" /> {view.prompt}
      </p>
      <p className="text-sm text-white/60">
        Objetivo: {label} {targetText(view.target, decimals, unit)} · Intento {Math.min(tries + 1, view.max_tries)} de{" "}
        {view.max_tries}
      </p>

      <div className="grid gap-5">
        {view.variables.map((variable) => {
          const places = stepDecimals(variable.step);
          const shown = format(values[variable.key], places);
          return (
            <div key={variable.key}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <label htmlFor={`sim-${variable.key}`} className="text-sm font-semibold text-white">
                  {variable.label}
                </label>
                <span className="font-display text-lg tabular-nums text-white">
                  {shown} {variable.unit}
                </span>
              </div>
              <input
                id={`sim-${variable.key}`}
                type="range"
                min={variable.min}
                max={variable.max}
                step={variable.step}
                value={values[variable.key]}
                aria-valuetext={`${shown} ${variable.unit}`.trim()}
                disabled={over || sending}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [variable.key]: Number(event.target.value) }))
                }
                className="w-full accent-[#E9501E]"
              />
              <div className="flex justify-between text-xs text-white/40">
                <span>{format(variable.min, places)}</span>
                <span>{format(variable.max, places)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "flex flex-col items-center gap-1 border px-6 py-5 text-center",
          live !== null && meets(view.target, live) ? "border-success bg-success/10" : "border-white/15 bg-white/5",
        )}
        aria-live="polite"
      >
        <p className="text-[11px] font-bold uppercase tracking-label text-white/50">{label}</p>
        <p className="font-display text-4xl font-semibold tabular-nums text-white">
          {live === null ? "—" : format(live, decimals)} <span className="text-lg text-white/60">{unit}</span>
        </p>
      </div>

      {!over && (
        <Button variant="accent" size="lg" onClick={submit} loading={sending} className="self-center">
          Probar estos valores
        </Button>
      )}

      {last?.text && (
        <motion.div
          key={tries}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className={cn(
            "flex items-start gap-3 border-l-2 px-4 py-3",
            last.met ? "border-success bg-success/10" : "border-destructive bg-destructive/10",
          )}
        >
          {last.met ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          ) : (
            <CircleX className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          )}
          <p className="text-white/90">{last.text}</p>
        </motion.div>
      )}
      {!over && tries > 0 && !last?.met && view.hint && (
        <p className="flex items-start gap-2 text-sm text-white/70">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {view.hint}
        </p>
      )}
    </div>
  );
}
