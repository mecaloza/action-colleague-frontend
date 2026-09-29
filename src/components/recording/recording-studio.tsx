"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * Teleprompter-style studio: your slides big, your camera small, keyboard arrows to change slide.
 * Every slide change is timestamped so the server can rebuild the exact presentation.
 */
export function RecordingStudio({ slides, maxSeconds = 1800, onFinish, locked = false, onTakeChange }: RecordingStudioProps) {
  const video = useRef<HTMLVideoElement>(null);
  const { status, error, elapsed, level, countdown, recording, openCamera, start, pause, resume, stop, markSlide, discard } =
    useRecorder();
  const [slide, setSlide] = useState(0);
  const hasSlides = slides.length > 0;

  // The recorder releases the camera by itself when the studio unmounts.
  useEffect(() => {
    openCamera(video.current);
  }, [openCamera]);

  useEffect(() => {
    if (elapsed >= maxSeconds && status === "recording") stop();
  }, [elapsed, maxSeconds, status, stop]);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    setSlide(clamped);
    markSlide(clamped);
  };

  useEffect(() => {
    if (!hasSlides) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") goTo(slide + 1);
      if (event.key === "ArrowLeft" || event.key === "PageUp") goTo(slide - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
    <div className="overflow-hidden border border-ink-800 bg-ink-950 text-white">
      <div className="relative aspect-video">
        {hasSlides && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slides[slide]} alt={`Diapositiva ${slide + 1}`} className="h-full w-full object-contain" />
        )}
        <video
          ref={video}
          muted
          playsInline
          className={cn(
            "bg-black [transform:scaleX(-1)]",
            hasSlides
              ? "absolute bottom-4 right-4 aspect-square w-[22%] rounded-full object-cover ring-4 ring-accent"
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
            <Button variant="outline-inverse" size="icon-sm" onClick={() => goTo(slide - 1)} disabled={slide === 0} aria-label="Diapositiva anterior">
              <ChevronLeft />
            </Button>
            <span className="w-16 text-center text-sm tabular-nums text-white/70">{slide + 1} / {slides.length}</span>
            <Button variant="outline-inverse" size="icon-sm" onClick={() => goTo(slide + 1)} disabled={slide === slides.length - 1} aria-label="Diapositiva siguiente">
              <ChevronRight />
            </Button>
          </div>
        )}
        <LevelMeter level={level} />
        {/* Wraps on phones: "Usar esta grabación" must not be cut off at 375 px. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {(status === "ready" || status === "idle") && !recording && (
            <Button variant="accent" onClick={start} disabled={status !== "ready"}>
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
        <p className="border-t border-white/10 px-5 py-3 text-xs text-white/50">
          Consejo: usa las flechas ← → del teclado para cambiar de diapositiva mientras hablas.
        </p>
      )}
    </div>
  );
}
