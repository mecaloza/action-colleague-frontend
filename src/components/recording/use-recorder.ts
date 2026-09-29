"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RecordingFormat {
  mimeType: string;
  extension: "webm" | "mp4";
}

/** Container/codec the current browser can record (Safari records MP4, Chrome/Firefox WebM). */
export function pickRecordingFormat(): RecordingFormat | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: RecordingFormat[] = [
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
    { mimeType: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) ?? null;
}

export type RecorderStatus = "idle" | "requesting" | "ready" | "countdown" | "recording" | "paused" | "stopped" | "error";

export interface Recording {
  blob: Blob;
  extension: RecordingFormat["extension"];
  durationSeconds: number;
  /** Slide changes: [second, slide index] — the server composes the slides with these timings. */
  timeline: { at: number; slide: number }[];
}

/** Starts reading the microphone's loudness (0 to 1) on every animation frame. */
function startLevelMeter(media: MediaStream, onLevel: (level: number) => void) {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  context.createMediaStreamSource(media).connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const meter = { context, frame: 0 };
  const read = () => {
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (let index = 0; index < data.length; index += 1) peak = Math.max(peak, Math.abs(data[index] - 128));
    // Ten steps, like the meter: an unchanged value skips the re-render (this runs 60 times a second).
    onLevel(Math.round(Math.min(1, peak / 64) * 10) / 10);
    meter.frame = requestAnimationFrame(read);
  };
  meter.frame = requestAnimationFrame(read);
  return meter;
}

/** A message the person can act on, for each way the camera or the microphone can fail to open. */
function cameraError(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "El navegador bloqueó la cámara o el micrófono. Permite el acceso desde la barra de direcciones y vuelve a intentarlo.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No encontramos una cámara y un micrófono conectados.";
  if (name === "NotReadableError" || name === "AbortError")
    return "La cámara o el micrófono están en uso por otra aplicación (por ejemplo, Zoom o Teams). Ciérrala y vuelve a intentarlo.";
  return "No pudimos acceder a la cámara o al micrófono. Revisa los permisos del navegador.";
}

/**
 * Camera + microphone recorder. Durations come from a monotonic clock that excludes pauses,
 * never from state (the recorder's callbacks would read a stale value).
 */
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const clock = useRef({ startedAt: 0, pausedAt: 0, pausedTotal: 0 });
  const timeline = useRef<Recording["timeline"]>([]);
  const currentSlide = useRef(0);
  const tick = useRef<number>();
  const countdownTimer = useRef<number>();
  const meter = useRef<{ context: AudioContext; frame: number } | null>(null);
  const [format] = useState(pickRecordingFormat); // what the browser can record does not change: probe once

  const seconds = useCallback(() => {
    const { startedAt, pausedAt, pausedTotal } = clock.current;
    if (!startedAt) return 0;
    const now = pausedAt || performance.now();
    return Math.max(0, (now - startedAt - pausedTotal) / 1000);
  }, []);

  /** Releases the camera and microphone, the level meter and the timers. */
  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (meter.current) {
      cancelAnimationFrame(meter.current.frame);
      meter.current.context.close().catch(() => undefined);
      meter.current = null;
    }
    window.clearInterval(tick.current);
    window.clearInterval(countdownTimer.current);
  }, []);

  // Whether the component still wants the camera: a permission prompt can resolve after it closed.
  const active = useRef(true);
  // Which openCamera call is the current one: an older request that resolves late (a retry, or React's
  // development double effect) must hand its camera back instead of replacing the current stream.
  const attempt = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      release();
    };
  }, [release]);

  const openCamera = useCallback(async (video: HTMLVideoElement | null) => {
    attempt.current += 1;
    const current = attempt.current;
    const superseded = () => !active.current || current !== attempt.current;
    if (!format) {
      setError("Este navegador no puede grabar video. Usa Chrome, Edge, Firefox o Safari actualizados.");
      setStatus("error");
      return;
    }
    release(); // retrying must not leave the previous camera stream open
    setStatus("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Insecure context", "SecurityError"); // http, not https
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (superseded()) {
        media.getTracks().forEach((track) => track.stop()); // the studio closed, or asked again, meanwhile
        return;
      }
      stream.current = media;
      if (video) {
        video.srcObject = media;
        await video.play().catch(() => undefined);
        if (superseded()) return; // the newer call already released this stream
      }
      meter.current = startLevelMeter(media, setLevel);
      setStatus("ready");
    } catch (error) {
      if (superseded()) return;
      release(); // a failure after the camera opened must not leave it on
      setError(cameraError(error));
      setStatus("error");
    }
  }, [format, release]);

  const begin = useCallback(() => {
    if (!stream.current || !format) return;
    const { mimeType, extension } = format;
    chunks.current = [];
    timeline.current = [{ at: 0, slide: currentSlide.current }];
    let failed = false;
    const fail = (message: string) => {
      failed = true;
      window.clearInterval(tick.current);
      chunks.current = [];
      setError(message);
      setStatus("error"); // "Reintentar" opens the camera again
    };
    let media: MediaRecorder;
    try {
      media = new MediaRecorder(stream.current, { mimeType, videoBitsPerSecond: 2_500_000 });
      media.ondataavailable = (event) => event.data.size > 0 && chunks.current.push(event.data);
      media.onstop = () => {
        window.clearInterval(tick.current);
        if (failed) return; // after an error the browser still fires "stop": keep the error on screen
        const blob = new Blob(chunks.current, { type: mimeType.split(";")[0] });
        setRecording({ blob, extension, durationSeconds: seconds(), timeline: [...timeline.current] });
        setStatus("stopped");
      };
      media.onerror = () => fail("La grabación se interrumpió. Intenta de nuevo.");
      media.start(1000); // throws if the camera or the microphone went away during the countdown
    } catch {
      fail("No pudimos empezar a grabar. Revisa que la cámara y el micrófono sigan conectados e intenta de nuevo.");
      return;
    }
    recorder.current = media;
    clock.current = { startedAt: performance.now(), pausedAt: 0, pausedTotal: 0 };
    tick.current = window.setInterval(() => setElapsed(seconds()), 250);
    setStatus("recording");
  }, [format, seconds]);

  const start = useCallback(() => {
    // The level meter's audio context may start suspended until a user gesture (this click).
    void meter.current?.context.resume();
    setRecording(null);
    setElapsed(0);
    setStatus("countdown");
    let remaining = 3;
    setCountdown(remaining);
    countdownTimer.current = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(countdownTimer.current);
        begin();
      }
    }, 1000);
  }, [begin]);

  const pause = useCallback(() => {
    if (recorder.current?.state !== "recording") return;
    recorder.current.pause();
    clock.current.pausedAt = performance.now();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (recorder.current?.state !== "paused") return;
    recorder.current.resume();
    clock.current.pausedTotal += performance.now() - clock.current.pausedAt;
    clock.current.pausedAt = 0;
    setStatus("recording");
  }, []);

  const stop = useCallback(() => {
    window.clearInterval(tick.current);
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }, []);

  /** Remembers the slide on screen and, while recording, timestamps the change. */
  const markSlide = useCallback(
    (slide: number) => {
      currentSlide.current = slide;
      if (recorder.current?.state === "recording") {
        timeline.current.push({ at: Math.round(seconds() * 100) / 100, slide });
      }
    },
    [seconds],
  );

  const discard = useCallback(() => {
    setRecording(null);
    setElapsed(0);
    setStatus(stream.current ? "ready" : "idle");
  }, []);

  return { status, error, elapsed, level, countdown, recording, openCamera, start, pause, resume, stop, markSlide, discard };
}
