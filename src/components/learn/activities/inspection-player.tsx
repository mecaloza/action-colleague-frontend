"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, CircleX, Search } from "lucide-react";
import type { InspectionView, InspectionZone } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./activity-player";

type Hit = "problem" | "distractor" | "none" | "already";

interface Feedback {
  hit: Hit;
  zone: InspectionZone | null;
}

const KEY_STEP = 0.02; // the keyboard's crosshair moves 2% of the picture (10% with Shift)
const percent = (value: number) => `${Math.round(value * 100)} %`;

/** Find the problems on a picture: the learner taps, the server says what is there. */
export function InspectionPlayer({
  view,
  move,
  narration,
  imageUrl,
}: PlayerProps<InspectionView> & { imageUrl: string | null }) {
  const reduce = useReducedMotion();
  const picture = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState<InspectionZone[]>(view.revealed);
  const [missed, setMissed] = useState<InspectionZone[]>([]);
  const [found, setFound] = useState(view.found);
  const [misses, setMisses] = useState(view.misses);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [tap, setTap] = useState<{ x: number; y: number; key: number } | null>(null);
  const [sending, setSending] = useState(false);
  // Where the keyboard's crosshair is (shown while the picture has the focus).
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const [focused, setFocused] = useState(false);
  const over = view.done;

  const send = async (x: number, y: number) => {
    if (sending || over) return;
    setTap({ x, y, key: Date.now() });
    setSending(true);
    const outcome = await move({ x, y });
    setSending(false);
    if (!outcome) return;
    const result = outcome.result as unknown as {
      hit: Hit;
      zone: InspectionZone | null;
      found?: number;
      misses?: number;
      missed?: InspectionZone[];
    };
    setFeedback({ hit: result.hit, zone: result.zone });
    narration.say([result.zone ? outcome.narration[result.zone.line] : undefined]);
    if (result.zone && result.hit !== "already") setRevealed((zones) => [...zones, result.zone as InspectionZone]);
    if (result.found !== undefined) setFound(result.found);
    if (result.misses !== undefined) setMisses(result.misses);
    if (result.missed) setMissed(result.missed);
  };

  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (event.key in moves) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      setCursor((at) => ({ x: Math.min(1, Math.max(0, at.x + dx)), y: Math.min(1, Math.max(0, at.y + dy)) }));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void send(cursor.x, cursor.y);
    }
  };

  const tapAt = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = picture.current?.getBoundingClientRect();
    if (!box) return;
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    void send(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-lg text-white">
          <Search className="h-5 w-5 text-accent" /> {view.prompt}
        </p>
        <p className="text-sm text-white/70" aria-live="polite">
          Encontrados <strong className="text-white">{found}</strong> de {view.problems} · Fallos{" "}
          <strong className="text-white">{misses}</strong> de {view.max_misses}
        </p>
      </div>

      <div
        ref={picture}
        onClick={tapAt}
        onKeyDown={over ? undefined : onKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        tabIndex={over ? -1 : 0}
        className={cn(
          "relative w-full select-none overflow-hidden border border-white/15 outline-none focus-visible:ring-2 focus-visible:ring-accent",
          !over && "cursor-crosshair",
        )}
        role="application"
        aria-label={`Imagen para inspeccionar: ${view.prompt}. Toca donde veas un problema, o usa las flechas para mover la mira (Mayús para pasos grandes) y Enter para revisar ese punto.`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL, not an optimizable asset
          <img src={imageUrl} alt="" className="block h-auto w-full" draggable={false} />
        ) : (
          <div className="aspect-video bg-white/5" />
        )}
        {[...revealed, ...missed].map((zone) => (
          <motion.span
            key={zone.id}
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "pointer-events-none absolute border-2",
              zone.is_problem ? "border-success bg-success/15" : "border-destructive bg-destructive/15",
              missed.includes(zone) && "border-dashed border-warning bg-warning/10",
            )}
            style={{
              left: `${zone.x * 100}%`,
              top: `${zone.y * 100}%`,
              width: `${zone.w * 100}%`,
              height: `${zone.h * 100}%`,
            }}
          >
            <span className="absolute left-0 top-0 bg-ink-950/85 px-1.5 py-0.5 text-[11px] font-semibold">
              {zone.label}
            </span>
          </motion.span>
        ))}
        <AnimatePresence>
          {tap && (
            <motion.span
              key={tap.key}
              initial={{ opacity: 0.9, scale: 0.4 }}
              animate={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: reduce ? 0 : 0.6 }}
              className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent"
              style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%` }}
            />
          )}
        </AnimatePresence>
        {focused && !over && (
          <span
            className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-accent"
            style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
            aria-hidden
          />
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {focused && !over ? `Mira a ${percent(cursor.x)} desde la izquierda y ${percent(cursor.y)} desde arriba.` : ""}
      </p>

      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            key={`${feedback.hit}-${feedback.zone?.id ?? tap?.key}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className={cn(
              "flex items-start gap-3 border-l-2 px-4 py-3",
              feedback.hit === "problem" ? "border-success bg-success/10" : "border-destructive bg-destructive/10",
            )}
          >
            {feedback.hit === "problem" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <CircleX className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            )}
            <div>
              <p className="font-semibold text-white">
                {feedback.hit === "problem"
                  ? `¡Encontraste un problema: ${feedback.zone?.label}!`
                  : feedback.hit === "distractor"
                    ? `${feedback.zone?.label}: aquí no hay problema`
                    : feedback.hit === "already"
                      ? `Ya revisaste: ${feedback.zone?.label}`
                      : "Ahí no hay nada que señalar"}
              </p>
              {feedback.zone && <p className="mt-1 text-white/80">{feedback.zone.explanation}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {missed.length > 0 && (
        <div className="border-l-2 border-warning bg-warning/10 px-4 py-3">
          <p className="font-semibold text-white">Te faltó encontrar:</p>
          {missed.map((zone) => (
            <p key={zone.id} className="mt-1 text-white/80">
              <strong>{zone.label}:</strong> {zone.explanation}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
