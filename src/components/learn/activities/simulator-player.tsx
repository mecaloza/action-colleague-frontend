"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, CircleX, FlaskConical, Lightbulb, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Language, SimulatorTarget, SimulatorTry, SimulatorVariable, SimulatorView } from "@/lib/api/types";
import { computeFormula } from "@/lib/formula";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./activity-player";

// How each course language writes its numbers: "6,000.5" in Mexico, "6.000,5" in Brazil.
const LOCALES: Record<Language, string> = { es: "es-MX", en: "en-US", pt: "pt-BR" };
// Money symbols go before the number ("$6,000", "US$ 6,000", "€6,000"); any other unit goes after it.
const MONEY = /^(?:[A-Za-z]{1,3}\$|[$€£¥₡₲₱]|S\/)$/;

function format(value: number, decimals: number, locale: string): string {
  return value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** What goes before and after a number for its unit. */
function unitParts(unit: string): { before: string; after: string } {
  if (!unit) return { before: "", after: "" };
  if (MONEY.test(unit)) return { before: unit.length > 1 ? `${unit} ` : unit, after: "" };
  return { before: "", after: ` ${unit}` };
}

/** "$6,000", "-$500", "100,000 km". */
function withUnit(number: string, unit: string): string {
  const { before, after } = unitParts(unit);
  return before && number.startsWith("-") ? `-${before}${number.slice(1)}` : `${before}${number}${after}`;
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

function targetText(target: SimulatorTarget, decimals: number, unit: string, locale: string): string {
  const shown = (value: number) => withUnit(format(value, decimals, locale), unit);
  if (target.op === "lte") return `${shown(target.value)} o menos`;
  if (target.op === "gte") return `${shown(target.value)} o más`;
  // "entre $4 y $5", "entre 4 y 5 km": money on both ends, any other unit once at the end.
  const low = unitParts(unit).before ? shown(target.value) : format(target.value, decimals, locale);
  return `entre ${low} y ${shown(target.value2)}`;
}

function meets(target: SimulatorTarget, result: number): boolean {
  if (target.op === "lte") return result <= target.value;
  if (target.op === "gte") return result >= target.value;
  return target.value <= result && result <= target.value2;
}

/** Move the controls until the result meets the target; each try is checked by the server. */
export function SimulatorPlayer({
  view,
  move,
  narration,
  language = "es",
}: PlayerProps<SimulatorView> & { language?: Language }) {
  const reduce = useReducedMotion();
  const locale = LOCALES[language] ?? LOCALES.es;
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      view.variables.map((variable) => [variable.key, view.last?.values[variable.key] ?? variable.default]),
    ),
  );
  const [tries, setTries] = useState(view.tries);
  const [last, setLast] = useState<(SimulatorTry & { text?: string }) | null>(view.last);
  const [sending, setSending] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const live = computeFormula(
    view.formula,
    Object.fromEntries(view.variables.map((variable) => [variable.key, onStep(variable, values[variable.key])])),
  );
  const { decimals, unit, label } = view.output;
  const over = view.done;
  const output = unitParts(unit);
  const liveText = live === null ? "—" : format(live, decimals, locale);
  const negative = Boolean(output.before) && liveText.startsWith("-");
  const attempts = !over
    ? `Intento ${tries + 1} de ${view.max_tries}`
    : last?.met
      ? `Lo lograste en ${plural(tries, "intento")}`
      : `Usaste los ${view.max_tries} intentos`;

  // After each try, what the server said comes into sight (on a phone, above the try button stuck to the bottom).
  useEffect(() => {
    if (tries > view.tries) feedback.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per new try
  }, [tries]);

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

  /** One step down or up: fine values without dragging. */
  const nudge = (variable: SimulatorVariable, direction: 1 | -1) =>
    setValues((current) => ({
      ...current,
      [variable.key]: onStep(variable, current[variable.key] + direction * variable.step),
    }));

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2 text-lg text-white">
        <FlaskConical className="mt-1 h-5 w-5 shrink-0 text-accent" />
        <span className="min-w-0">{view.prompt}</span>
      </p>
      <p className="text-sm text-white/60">
        Objetivo: {label} {targetText(view.target, decimals, unit, locale)} · {attempts}
      </p>

      <div className="grid gap-5">
        {view.variables.map((variable) => {
          const places = stepDecimals(variable.step);
          const value = values[variable.key];
          const shown = withUnit(format(value, places, locale), variable.unit);
          const fill = ((value - variable.min) / (variable.max - variable.min)) * 100;
          const locked = over || sending;
          return (
            <div key={variable.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <label htmlFor={`sim-${variable.key}`} className="min-w-0 text-sm font-semibold text-white">
                  {variable.label}
                </label>
                <span className="shrink-0 font-display text-lg tabular-nums text-white">{shown}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline-inverse"
                  size="icon"
                  className="shrink-0"
                  aria-label={`Disminuir ${variable.label}`}
                  disabled={locked || value <= variable.min}
                  onClick={() => nudge(variable, -1)}
                >
                  <Minus />
                </Button>
                <input
                  id={`sim-${variable.key}`}
                  type="range"
                  min={variable.min}
                  max={variable.max}
                  step={variable.step}
                  value={value}
                  aria-valuetext={shown}
                  disabled={locked}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [variable.key]: Number(event.target.value) }))
                  }
                  className="range min-w-0 flex-1"
                  style={{ "--range-fill": `${fill}%` } as CSSProperties}
                />
                <Button
                  variant="outline-inverse"
                  size="icon"
                  className="shrink-0"
                  aria-label={`Aumentar ${variable.label}`}
                  disabled={locked || value >= variable.max}
                  onClick={() => nudge(variable, 1)}
                >
                  <Plus />
                </Button>
              </div>
              <div className="flex justify-between px-12 text-xs text-white/50">
                <span>{format(variable.min, places, locale)}</span>
                <span>{format(variable.max, places, locale)}</span>
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
        <p className="text-xs font-bold uppercase tracking-label text-white/50">{label}</p>
        <p className="font-display text-4xl font-semibold tabular-nums text-white">
          {negative && "-"}
          {output.before && <span className="text-lg text-white/60">{output.before}</span>}
          {negative ? liveText.slice(1) : liveText}
          {output.after && <span className="text-lg text-white/60">{output.after}</span>}
        </p>
      </div>

      {!over && (
        // On a phone the try stays at hand, stuck to the bottom of the screen under what the last one said.
        <div className="sticky bottom-0 z-10 order-last -mx-4 flex justify-center border-t border-white/10 bg-ink-950/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:order-none sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button variant="accent" size="lg" onClick={submit} loading={sending} className="w-full sm:w-auto">
            Probar estos valores
          </Button>
        </div>
      )}

      {last?.text && (
        <motion.div
          ref={feedback}
          key={tries}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className={cn(
            "flex scroll-mb-32 items-start gap-3 border-l-2 px-4 py-3 sm:scroll-mb-0",
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
