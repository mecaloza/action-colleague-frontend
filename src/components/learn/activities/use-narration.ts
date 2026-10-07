"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MUTED_KEY = "activity-voice-muted";

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The narrator of an activity: plays its voice clips one after the other (a consequence, then the next
 * situation), cutting the previous line when a new one starts. Browsers only allow sound after a gesture: the
 * first clip plays from the learner's "Empezar". The text is always on screen, so a muted (or failed) voice
 * loses nothing.
 */
export function useNarration() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const queue = useRef<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = readMuted();
    setMuted(mutedRef.current);
    return () => {
      queue.current = [];
      audio.current?.pause();
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
    element.play().catch(next); // blocked or failed: on to the next line (the text is on screen)
  }, []);

  /** Say these clips in order, after cutting whatever is being said. */
  const say = useCallback(
    (urls: (string | undefined)[]) => {
      queue.current = urls.filter((url): url is string => Boolean(url));
      audio.current?.pause();
      next();
    },
    [next],
  );

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

  return { say, muted, speaking, toggleMuted };
}

export type Narration = ReturnType<typeof useNarration>;
