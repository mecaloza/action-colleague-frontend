"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, CircleX, Crosshair, Search } from "lucide-react";
import type { InspectionView, InspectionZone } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./activity-player";

type Hit = "problem" | "distractor" | "none" | "already";

interface Feedback {
  hit: Hit;
  zone: InspectionZone | null;
}

const GRID = [0, 1, 2].flatMap((row) => [0, 1, 2].map((column) => ({ row, column })));
const CELL_NAMES = ["arriba", "al centro", "abajo"];
const COLUMN_NAMES = ["a la izquierda", "en medio", "a la derecha"];

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
        className={cn(
          "relative w-full select-none overflow-hidden border border-white/15",
          !over && "cursor-crosshair",
        )}
        role="img"
        aria-label={`Imagen para inspeccionar: ${view.prompt}`}
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
      </div>

      {/* Without a precise tap: each ninth of the picture as a button. */}
      {!over && (
        <details className="text-sm text-white/70">
          <summary className="cursor-pointer">Revisar por zonas (sin tocar la imagen)</summary>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {GRID.map(({ row, column }) => (
              <button
                key={`${row}-${column}`}
                type="button"
                onClick={() => send((column + 0.5) / 3, (row + 0.5) / 3)}
                disabled={sending}
                className="flex items-center justify-center gap-1 border border-white/20 px-2 py-2 hover:border-accent disabled:opacity-50"
              >
                <Crosshair className="h-3.5 w-3.5" /> {CELL_NAMES[row]} {COLUMN_NAMES[column]}
              </button>
            ))}
          </div>
        </details>
      )}

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
