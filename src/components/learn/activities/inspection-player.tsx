"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, CircleX, Flame, Heart, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InspectionItem, InspectionView } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./activity-player";
import { LOOK_LABELS, TireTread } from "./tire-tread";

/** Both scenes are two columns wide: a truck's left and right tires, or two columns of cards. */
const COLUMNS = 2;
// How tall a phone's sheet (facts and decisions) may grow: tiles scrolled to stop above it.
const SHEET = { "--sheet": "55dvh" } as CSSProperties;
const DIRECTIONS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
};

interface MoveResult {
  correct: boolean;
  points: number;
  lives: number;
  streak: number;
  item: InspectionItem;
  /** When the play is over: every item, with its answer. */
  items?: InspectionItem[];
}

/** The item a step from `index` lands on (it stays put at an edge). */
function stepFrom(index: number, [dx, dy]: [number, number], count: number): number {
  const column = Math.min(COLUMNS - 1, Math.max(0, (index % COLUMNS) + dx));
  const row = Math.floor(index / COLUMNS) + dy;
  const target = row * COLUMNS + column;
  return row < 0 || target >= count ? index : target;
}

/**
 * Inspect each item (a tire on a truck, or a case on a card), read its facts and decide what to do with it. A
 * right decision scores (more in a row); a wrong one costs a life. Played with the mouse, a finger or the keyboard:
 * arrows or WASD to move, 1-4 to decide. On a phone the selected item's facts and decisions are a sheet at the
 * bottom of the screen, over the diagram, so deciding never needs a scroll.
 */
export function InspectionPlayer({
  view,
  move,
  narration,
  imageUrl,
}: PlayerProps<InspectionView> & { imageUrl: string | null }) {
  const reduce = useReducedMotion();
  const [items, setItems] = useState(view.items);
  const [lives, setLives] = useState(view.lives);
  const [streak, setStreak] = useState(view.streak);
  const [selected, setSelected] = useState(() => Math.max(0, view.items.findIndex((item) => !item.outcome)));
  const [sending, setSending] = useState(false);
  const [gain, setGain] = useState<{ key: number; points: number; correct: boolean } | null>(null);
  // What a screen reader hears after each decision (a live region mounted from the start, so it is read).
  const [announcement, setAnnouncement] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const nextButton = useRef<HTMLButtonElement>(null);
  const outcomeBox = useRef<HTMLDivElement>(null);
  const justDecided = useRef(false);
  const over = view.done;
  const truck = view.scene === "truck";
  const item = items[selected];
  const decided = items.filter((other) => other.chosen).length;
  const right = items.filter((other) => other.outcome?.correct).length;
  const pending = (() => {
    for (let step = 1; step <= items.length; step += 1) {
      const index = (selected + step) % items.length;
      if (!items[index].outcome) return index;
    }
    return -1;
  })();

  const select = (index: number) => {
    setSelected(index);
    const tile = tiles.current[index];
    // Into sight above a phone's sheet (the tiles' bottom scroll margin); the keyboard goes on with it.
    tile?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    tile?.focus({ preventScroll: true });
  };

  const decide = async (verdict: string) => {
    if (!item || item.outcome || sending || over) return;
    setSending(true);
    const outcome = await move({ item: item.id, verdict });
    setSending(false);
    if (!outcome) return;
    const result = outcome.result as unknown as MoveResult;
    setItems((current) => result.items ?? current.map((other) => (other.id === result.item.id ? result.item : other)));
    setLives(result.lives);
    setStreak(result.streak);
    setGain({ key: Date.now(), points: result.points, correct: result.correct });
    setAnnouncement(
      result.correct
        ? `Correcto: +${plural(result.points, "punto")}.`
        : `Incorrecto: era ${result.item.outcome?.answer_label}. Te quedan ${plural(result.lives, "vida")}.`,
    );
    justDecided.current = true;
    narration.say([result.item.outcome ? outcome.narration[result.item.outcome.line] : undefined]);
  };

  // The keyboard starts on the first tire.
  useEffect(() => {
    tiles.current[selected]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the game appears
  }, []);

  // Right after a decision its outcome comes into sight (inside a phone's sheet too) and "Siguiente" takes the
  // focus (Enter moves on). After the last one, the game's "Ver resultado" takes it.
  useEffect(() => {
    if (!justDecided.current || !item?.outcome) return;
    justDecided.current = false;
    outcomeBox.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    if (!over) nextButton.current?.focus();
  }, [item?.outcome, over, reduce]);

  // The keyboard plays from anywhere in the game (the latest handler: no stale state).
  const onKey = useRef<(event: KeyboardEvent) => void>(() => {});
  onKey.current = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.defaultPrevented) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    // Another control of the dialog (mute, close, "Ver resultado") keeps its keys.
    const control = target?.closest("button, a, [role=slider]");
    if (control && !root.current?.contains(control)) return;
    const key = event.key.toLowerCase();
    const number = Number(key);
    if (Number.isInteger(number) && number >= 1 && number <= view.verdicts.length) {
      if (over) return;
      event.preventDefault();
      void decide(view.verdicts[number - 1].id);
    } else if (key in DIRECTIONS) {
      event.preventDefault();
      select(stepFrom(selected, DIRECTIONS[key], items.length));
    }
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const tile = (index: number) => {
    const other = items[index];
    if (!other) return <span />;
    const active = selected === index;
    const state = !other.outcome ? "pendiente" : other.outcome.correct ? "acertada" : "fallada";
    const waiting = !other.outcome && !active && !over && !reduce; // its badge beats, to call for a look
    const truckLook = other.look === "none" ? "even" : other.look; // a tire on the truck always has a tread
    return (
      <button
        key={other.id}
        ref={(element) => {
          tiles.current[index] = element;
        }}
        type="button"
        onClick={() => select(index)}
        aria-pressed={active}
        aria-label={`${other.label}: ${state}${truck ? ` · ${LOOK_LABELS[truckLook]}` : ""}`}
        className={cn(
          // A tile scrolled to stops below the status bar, and above the sheet that covers a phone's lower half.
          "relative flex scroll-mb-[calc(var(--sheet)+1rem)] scroll-mt-14 items-center justify-center border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:scroll-mb-0",
          truck
            ? "h-16 w-11 rounded-md p-1 sm:h-24 sm:w-16"
            : "min-h-20 w-full min-w-0 gap-2 px-3 py-2.5 text-left sm:min-h-24 sm:gap-3 sm:px-4 sm:py-3",
          active ? "border-accent bg-accent/15" : "border-white/15 hover:border-white/50",
        )}
      >
        {truck ? (
          <TireTread look={truckLook} />
        ) : (
          <>
            {other.look !== "none" && <TireTread look={other.look} className="h-12 shrink-0 sm:h-16" />}
            <span className="min-w-0 flex-1 break-words font-semibold text-white">{other.label}</span>
          </>
        )}
        <motion.span
          animate={{ scale: waiting ? [1, 1.25, 1] : 1 }}
          transition={{ duration: 1.4, repeat: waiting ? Infinity : 0 }}
          className={cn(
            "absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
            !other.outcome && "bg-accent text-ink-950",
            other.outcome?.correct && "bg-success text-white",
            other.outcome && !other.outcome.correct && "bg-destructive text-white",
          )}
          aria-hidden
        >
          {!other.outcome ? "?" : other.outcome.correct ? "✓" : "✗"}
        </motion.span>
        {truck && (
          <span className="absolute -bottom-5 text-xs font-semibold text-white/60" aria-hidden>
            {index + 1}
          </span>
        )}
      </button>
    );
  };

  const rows = Array.from({ length: Math.ceil(items.length / COLUMNS) }, (_, row) => row);

  return (
    <div ref={root} className="flex flex-col gap-4 sm:gap-5" style={SHEET}>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <p className="text-lg text-white">{view.prompt}</p>
      {/* Lives, streak and progress stay in sight under the header while the learner scrolls the diagram. */}
      <div className="sticky top-[var(--game-header,0px)] z-10 -mx-4 flex items-center gap-4 bg-ink-950/95 px-4 py-2 text-sm backdrop-blur sm:-mx-6 sm:px-6">
        <span className="flex items-center gap-0.5" aria-label={`${lives} de ${view.max_lives} vidas`} role="img">
          {Array.from({ length: view.max_lives }, (_, n) => (
            <motion.span key={n} animate={{ scale: n < lives ? 1 : 0.75, opacity: n < lives ? 1 : 0.35 }}>
              <Heart className={cn("h-5 w-5", n < lives ? "fill-destructive text-destructive" : "text-white/40")} />
            </motion.span>
          ))}
        </span>
        <span className="flex items-center gap-1 text-accent">
          <Flame className="h-4 w-4" /> Racha {streak}
        </span>
        <span className="tabular-nums text-white/70">
          {decided}/{items.length}
        </span>
        <AnimatePresence>
          {gain && (
            <motion.span
              key={gain.key}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : 1.2 }}
              className={cn(
                "pointer-events-none absolute right-4 top-1.5 font-display text-xl font-bold sm:right-6",
                gain.correct ? "text-accent" : "text-destructive",
              )}
              aria-hidden
            >
              {gain.correct ? `+${gain.points}` : "−1 vida"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <p className="flex items-center gap-2 text-xs text-white/50 touch:hidden">
        <Keyboard className="h-4 w-4" /> Flechas o WASD: elegir · 1–{view.verdicts.length}: decidir · Enter: siguiente
      </p>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL, not an optimizable asset
        <img src={imageUrl} alt="Foto de referencia" className="max-h-48 w-auto self-start border border-white/15" />
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {truck ? (
          <div className="mx-auto w-full max-w-xs" role="group" aria-label="Llantas de la unidad">
            <div
              className="mx-auto h-12 w-3/5 rounded-t-[2rem] border border-white/20 bg-white/10 pt-2.5 sm:h-16 sm:pt-3"
              aria-hidden
            >
              <div className="mx-auto h-4 w-4/5 rounded-t-xl bg-sky-300/30 sm:h-5" />
            </div>
            <div className="relative pb-4">
              <div
                className="absolute inset-y-0 left-1/2 w-1/4 -translate-x-1/2 border-x-4 border-white/15"
                aria-hidden
              />
              {rows.map((row) => (
                <div key={row} className="relative grid grid-cols-[auto_1fr_auto] items-center gap-2 py-3 sm:py-4">
                  {tile(row * COLUMNS)}
                  <div className="relative h-1.5 bg-white/25" aria-hidden>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold uppercase tracking-label text-white/50">
                      {row === 0 ? "Dirección" : `Eje ${row + 1}`}
                    </span>
                  </div>
                  {tile(row * COLUMNS + 1)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 content-start gap-3" role="group" aria-label="Casos para revisar">
            {items.map((_, index) => tile(index))}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {item && (
            <motion.section
              key={item.id}
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -12 }}
              className={cn(
                // Phones: a sheet stuck to the bottom of the game (above "Ver resultado" once it is over).
                "sticky bottom-[var(--action-bar,0px)] z-10 -mx-4 flex max-h-[var(--sheet)] flex-col border-t border-white/15 bg-ink-900 shadow-[0_-16px_32px_-12px_rgba(0,0,0,0.8)] sm:-mx-6",
                "md:static md:mx-0 md:max-h-none md:self-start md:border md:bg-white/5 md:shadow-none",
              )}
              aria-label={item.label}
            >
              {/* The facts and the outcome scroll inside the sheet; the decisions below them never do. */}
              <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 sm:px-6 md:overflow-visible md:px-5 md:pt-5">
                <div className="flex items-start gap-4">
                  {item.look !== "none" && <TireTread look={item.look} className="h-20 shrink-0 md:h-32" />}
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow text-white/50">
                      {selected + 1} de {items.length}
                    </p>
                    <h3 className="break-words font-display text-lg text-white md:text-xl">{item.label}</h3>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 md:mt-3">
                      {item.facts.map((fact, index) => (
                        <div key={index} className="min-w-0">
                          <dt className="break-words text-xs font-bold uppercase tracking-label text-white/50">
                            {fact.label}
                          </dt>
                          <dd className="break-words font-semibold tabular-nums text-white">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                {item.outcome && (
                  <motion.div
                    ref={outcomeBox}
                    initial={reduce ? false : { scale: 0.96 }}
                    animate={{ scale: 1, x: !item.outcome.correct && !reduce ? [0, -6, 6, -4, 4, 0] : 0 }}
                    role="status"
                    className={cn(
                      "mt-4 border-l-2 px-4 py-3",
                      item.outcome.correct ? "border-success bg-success/10" : "border-destructive bg-destructive/10",
                    )}
                  >
                    <p className="flex items-center gap-2 font-semibold text-white">
                      {item.outcome.correct ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                      ) : (
                        <CircleX className="h-5 w-5 shrink-0 text-destructive" />
                      )}
                      {item.outcome.correct
                        ? `¡Bien! ${item.outcome.answer_label}`
                        : item.chosen
                          ? `No: lo correcto era ${item.outcome.answer_label}`
                          : `Lo correcto: ${item.outcome.answer_label}`}
                    </p>
                    <p className="mt-1 text-white/80">{item.outcome.explanation}</p>
                  </motion.div>
                )}
              </div>

              <div
                className={cn(
                  "shrink-0 px-4 pt-3 sm:px-6 md:px-5 md:pb-5",
                  // The bar under the sheet keeps clear of the home indicator once the game is over.
                  over ? "pb-4" : "pb-[max(1rem,env(safe-area-inset-bottom))]",
                )}
              >
                {item.outcome ? (
                  over ? (
                    <p className="text-center font-semibold text-white" role="status">
                      {lives === 0 ? "Te quedaste sin vidas. " : "¡Inspección terminada! "}
                      Acertaste {right} de {items.length}: toca cada {truck ? "llanta" : "caso"} para repasar por qué.
                    </p>
                  ) : (
                    pending >= 0 && (
                      <div className="flex justify-end">
                        <Button ref={nextButton} variant="accent" onClick={() => select(pending)}>
                          Siguiente <ArrowRight />
                        </Button>
                      </div>
                    )
                  )
                ) : (
                  <>
                    <p className="eyebrow mb-2 text-white/50">¿Qué haces?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {view.verdicts.map((verdict, index) => (
                        <button
                          key={verdict.id}
                          type="button"
                          onClick={() => decide(verdict.id)}
                          aria-keyshortcuts={String(index + 1)}
                          disabled={sending || over}
                          className="flex min-h-12 items-center gap-3 border border-white/25 px-3 py-2 text-left text-white transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 sm:px-4"
                        >
                          {/* The key that decides it: only where there is a keyboard. */}
                          <kbd
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/30 bg-white/10 text-sm font-bold touch:hidden"
                            aria-hidden
                          >
                            {index + 1}
                          </kbd>
                          <span className="min-w-0 break-words">{verdict.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
