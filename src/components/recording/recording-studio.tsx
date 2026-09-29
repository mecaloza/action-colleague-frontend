"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Circle, Pause, Play, RotateCcw, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type Recording, useRecorder } from "./use-recorder";

interface RecordingStudioProps {
  /** Rendered slide images (from the uploaded PDF), in order. Empty = camera only. */
  slides: string[];
  maxSeconds?: number;
  onFinish: (recording: Recording) => void;
  /** The take is being uploaded: it can be neither discarded nor sent again. */
  locked?: boolean;
  /** Whether closing now would lose something (a countdown, a recording in progress or a take not sent yet). */
  onTakeChange?: (hasTake: boolean) => void;
}

function LevelMeter({ level }: { level: number }) {
  return (
    <div className="flex h-4 items-end gap-0.5" aria-hidden>
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          className={cn("w-1 transition-colors", index / 10 < level ? (index > 7 ? "bg-warning" : "bg-success") : "bg-white/20")}
          style={{ height: `${40 + index * 6}%` }}
        />
      ))}
    </div>
  );
}

/** How many slides a key moves, as in presentation software (a clicker sends PageDown and PageUp); 0 for any other key. */
function slideStep(key: string): number {
  if (key === "ArrowRight" || key === "PageDown") return 1;
  if (key === "ArrowLeft" || key === "PageUp") return -1;
  return 0;
}

/** Whether a key pressed on `target` is for the studio: not for a field or a player, nor for a dialog open over it. */
function isForStudio(target: EventTarget | null, studio: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("input, textarea, select, [contenteditable], video, audio")) return false;
  const dialog = target.closest('[role="dialog"], [role="alertdialog"]');
  return !dialog || dialog.contains(studio);
}

// An arrow at the first or the last slide looks disabled but keeps the focus (`disabled` would drop it).
const LOOKS_DISABLED = "aria-disabled:pointer-events-none aria-disabled:opacity-45";

/**
 * Teleprompter-style studio: your slides big, your camera small, keyboard arrows to change slide.
 * Every slide change is timestamped so the server can rebuild the exact presentation.
 */
export function RecordingStudio({ slides, maxSeconds = 1800, onFinish, locked = false, onTakeChange }: RecordingStudioProps) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const recordButton = useRef<HTMLButtonElement>(null);
  const { status, error, elapsed, level, countdown, recording, openCamera, start, pause, resume, stop, markSlide, discard } =
    useRecorder();
  const [slide, setSlide] = useState(0);
  // The slide on screen, for the keyboard listener: it outlives renders, so `slide` would be stale there.
  const shown = useRef(0);
  const slideCount = slides.length;
  const hasSlides = slideCount > 0;

  // The recorder releases the camera by itself when the studio unmounts.
  useEffect(() => {
    openCamera(video.current);
  }, [openCamera]);

  useEffect(() => {
    if (elapsed >= maxSeconds && status === "recording") stop();
  }, [elapsed, maxSeconds, status, stop]);

  // Ready to record (the studio just opened, or after "Repetir"): Grabar takes the focus if nothing has it
  // (it is on the page or the dialog itself, e.g. after the button that had it went away).
  useEffect(() => {
    const focused = document.activeElement;
    if (status === "ready" && (!focused || focused.contains(root.current))) recordButton.current?.focus();
  }, [status]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(slideCount - 1, next));
      if (clamped === shown.current) return; // an arrow held down at the first or last slide changes nothing
      shown.current = clamped;
      setSlide(clamped);
      markSlide(clamped);
    },
    [slideCount, markSlide],
  );

  // The buttons, the arrows or a presentation clicker change slide, except while reviewing the finished take.
  const navigable = hasSlides && status !== "stopped";
  const step = (delta: number) => {
    if (navigable) goTo(shown.current + delta);
  };
  useEffect(() => {
    if (!navigable) return;
    const onKey = (event: KeyboardEvent) => {
      const step = slideStep(event.key);
      if (!step || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!isForStudio(event.target, root.current)) return;
      event.preventDefault(); // PageDown and the arrows would also scroll the studio
      goTo(shown.current + step);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigable, goTo]);

  // The neighbouring slides load ahead, so a change mid-sentence never shows an empty stage.
  useEffect(() => {
    [slide + 1, slide - 1, slide + 2].forEach((index) => {
      if (slides[index]) new Image().src = slides[index];
    });
  }, [slide, slides]);

  const live = status === "recording" || status === "paused";
  const hasTake = status === "countdown" || live || recording !== null;
  useEffect(() => onTakeChange?.(hasTake), [hasTake, onTakeChange]);

  // The finished take, to watch it before using it (the camera preview has no sound).
  const [takeUrl, setTakeUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!recording || status !== "stopped") return setTakeUrl(null);
    const url = URL.createObjectURL(recording.blob);
    setTakeUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recording, status]);

  return (
    <div ref={root} className="overflow-hidden border border-ink-800 bg-ink-950 text-white">
      {/* Never taller than the window: a clicker's PageDown must not push the controls out of sight. */}
      <div className="relative mx-auto aspect-video max-w-[calc((100dvh_-_12rem)*16/9)]">
        {/* As in the final video (1920x1080): 48 px around the slide, a 340 px bubble 64 px from the corner. */}
        {hasSlides && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slides[slide]}
            alt={`Diapositiva ${slide + 1} de ${slideCount}`}
            className="h-full w-full object-contain p-[2.5%]"
          />
        )}
        <video
          ref={video}
          muted
          playsInline
          className={cn(
            "bg-black [transform:scaleX(-1)]",
            hasSlides
              ? "absolute bottom-[5.93%] right-[3.33%] aspect-square w-[17.7%] rounded-full object-cover ring-4 ring-accent"
              : "h-full w-full object-contain",
          )}
        />
        {takeUrl && (
          <video
            src={takeUrl}
            controls
            playsInline
            aria-label="Tu grabación"
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        )}
        {status === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="font-display text-[10rem] font-semibold leading-none text-white">{countdown}</span>
          </div>
        )}
        {live && (
          <span className="absolute left-4 top-4 inline-flex items-center gap-2 bg-black/70 px-3 py-1.5 text-xs font-bold uppercase tracking-label">
            <span className={cn("h-2.5 w-2.5 rounded-full bg-red-500", status === "recording" && "animate-pulse")} />
            {status === "recording" ? "Grabando" : "En pausa"} · {formatDuration(elapsed)}
          </span>
        )}
        {status === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-8 text-center">
            <p className="max-w-md text-white/80">{error}</p>
            <Button variant="inverse" onClick={() => openCamera(video.current)}>Reintentar</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 px-5 py-4">
        {hasSlides && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline-inverse"
              size="icon"
              onClick={() => step(-1)}
              aria-disabled={!navigable || slide === 0}
              aria-label="Diapositiva anterior"
              className={LOOKS_DISABLED}
            >
              <ChevronLeft />
            </Button>
            <span className="w-16 text-center text-sm tabular-nums text-white/70" aria-live="polite" aria-atomic>
              <span aria-hidden>{slide + 1} / {slideCount}</span>
              <span className="sr-only">Diapositiva {slide + 1} de {slideCount}</span>
            </span>
            <Button
              variant="outline-inverse"
              size="icon"
              onClick={() => step(1)}
              aria-disabled={!navigable || slide === slideCount - 1}
              aria-label="Diapositiva siguiente"
              className={LOOKS_DISABLED}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
        <LevelMeter level={level} />
        {/* Wraps on phones: "Usar esta grabación" must not be cut off at 375 px. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {(status === "ready" || status === "idle") && !recording && (
            <Button ref={recordButton} variant="accent" onClick={start} disabled={status !== "ready"}>
              <Circle className="fill-current" /> Grabar
            </Button>
          )}
          {status === "recording" && (
            <Button variant="outline-inverse" onClick={pause}><Pause /> Pausar</Button>
          )}
          {status === "paused" && (
            <Button variant="outline-inverse" onClick={resume}><Play /> Continuar</Button>
          )}
          {live && (
            <Button variant="inverse" onClick={stop}><Square className="fill-current" /> Terminar</Button>
          )}
          {recording && status === "stopped" && (
            <>
              <Button variant="outline-inverse" onClick={discard} disabled={locked}><RotateCcw /> Repetir</Button>
              <Button variant="accent" onClick={() => onFinish(recording)} loading={locked}><Upload /> Usar esta grabación</Button>
            </>
          )}
        </div>
      </div>
      {live && (
        <Progress value={(elapsed / maxSeconds) * 100} className="h-1 rounded-none bg-white/10" />
      )}
      {hasSlides && !live && status !== "stopped" && (
        // Only where there is a keyboard: not on touch screens.
        <p className="border-t border-white/10 px-5 py-3 text-xs text-white/50 [@media(pointer:coarse)]:hidden">
          Consejo: usa las flechas ← → del teclado para cambiar de diapositiva mientras hablas.
        </p>
      )}
    </div>
  );
}
