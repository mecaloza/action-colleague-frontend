"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MUTED_KEY = "activity-voice-muted";
// 10 ms of silence (8 kHz, 8-bit mono WAV): what `unlock` plays inside the learner's tap.
const SILENCE =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The narrator of an activity: plays its voice clips one after the other (a consequence, then the next
 * situation), cutting the previous line when a new one starts. Browsers only allow sound after a gesture, and
 * iOS only lets an audio element play after a network call if it already played inside a tap: `unlock()` runs
 * in the learner's "Empezar" and every line reuses that element. The text is always on screen, so a muted (or
 * failed) voice loses nothing.
 */
export function useNarration() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const queue = useRef<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mutedRef = useRef(false);
  const unlocked = useRef(false);
  const alive = useRef(true);
  // Each say() starts a new generation: a play() of an earlier one that fails late never skips the new lines.
  const generation = useRef(0);

  useEffect(() => {
    alive.current = true; // StrictMode mounts twice
    mutedRef.current = readMuted();
    setMuted(mutedRef.current);
    return () => {
      alive.current = false;
      queue.current = [];
      audio.current?.pause();
      audio.current?.removeAttribute("src");
    };
  }, []);

  const next = useCallback(() => {
    const url = queue.current.shift();
    if (!url || mutedRef.current) {
      setSpeaking(false);
      return;
    }
    const element = audio.current ?? new Audio();
    audio.current = element;
    element.onended = next;
    element.onerror = next;
    element.src = url;
    setSpeaking(true);
    const mine = generation.current;
    element.play().catch((error: unknown) => {
      // Blocked or failed: on to the next line (the text is on screen). An abort means a newer line took over.
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (!aborted && mine === generation.current) next();
    });
  }, []);

  /** Say these clips in order, after cutting whatever is being said. */
  const say = useCallback(
    (urls: (string | undefined)[]) => {
      if (!alive.current) return;
      generation.current += 1;
      queue.current = urls.filter((url): url is string => Boolean(url));
      audio.current?.pause();
      next();
    },
    [next],
  );

  /** Call synchronously inside a tap: plays a moment of silence so the lines said later (after a request) can play. */
  const unlock = useCallback(() => {
    if (unlocked.current) return;
    unlocked.current = true;
    const element = audio.current ?? new Audio();
    audio.current = element;
    const mine = generation.current;
    element.src = SILENCE;
    element.play().then(
      () => {
        if (mine === generation.current) element.pause(); // a line said meanwhile keeps playing
      },
      () => {
        unlocked.current = false; // refused: the next tap tries again
      },
    );
  }, []);

  const toggleMuted = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    try {
      window.localStorage.setItem(MUTED_KEY, mutedRef.current ? "1" : "0");
    } catch {
      // private mode: the choice lasts this visit
    }
    if (mutedRef.current) {
      queue.current = [];
      audio.current?.pause();
      setSpeaking(false);
    }
  }, []);

  return { say, unlock, muted, speaking, toggleMuted };
}

export type Narration = ReturnType<typeof useNarration>;
