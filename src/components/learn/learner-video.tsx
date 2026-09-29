"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { learnApi } from "@/lib/api/learn";
import type { LearnerModule } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { useStableUrl } from "@/lib/hooks/use-stable-url";

const SAVE_EVERY_SECONDS = 15;
const RESUME_MIN_SECONDS = 5; // closer to the start than this, starting over is nicer
const RESUME_TAIL_SECONDS = 10; // closer to the end than this, the video was watched

/** The module's video: resumes where the learner left it and keeps that position saved. */
export function LearnerVideo({ module }: { module: LearnerModule }) {
  const video = useRef<HTMLVideoElement>(null);
  const src = useStableUrl(module.video?.url);
  const poster = useStableUrl(module.poster_url);
  const captions = useStableUrl(module.captions_url);
  const saved = useRef(module.last_position_seconds);
  const [resumedAt, setResumedAt] = useState<number | null>(null);

  const save = useCallback(
    (seconds: number, keepalive = false) => {
      if (Math.abs(seconds - saved.current) < 1) return;
      saved.current = seconds;
      // Best effort, never in the way.
      learnApi.savePosition(module.id, Math.floor(seconds), keepalive).catch(() => undefined);
    },
    [module.id],
  );

  // Leaving the module keeps the last position too.
  useEffect(() => {
    const element = video.current;
    return () => {
      if (element && element.currentTime > 0) save(element.currentTime);
    };
  }, [save]);

  // Closing or reloading the tab unmounts nothing: save on the way out, with a request that outlives the page.
  useEffect(() => {
    const leave = () => {
      const element = video.current;
      if (element && element.currentTime > 0) save(element.currentTime, true);
    };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [save]);

  if (!src) return null;
  return (
    <div className="space-y-2">
      <video
        ref={video}
        key={src.split("?")[0]}
        src={src}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        crossOrigin={captions ? "anonymous" : undefined}
        className="aspect-video w-full bg-black"
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          const position = module.last_position_seconds;
          if (position > RESUME_MIN_SECONDS && position < element.duration - RESUME_TAIL_SECONDS) {
            element.currentTime = position;
            setResumedAt(position);
          }
        }}
        onTimeUpdate={(event) => {
          const seconds = event.currentTarget.currentTime;
          if (seconds - saved.current >= SAVE_EVERY_SECONDS) save(seconds);
        }}
        onPause={(event) => save(event.currentTarget.currentTime)}
        onEnded={(event) => save(event.currentTarget.duration)}
      >
        {captions && <track kind="subtitles" src={captions} srcLang="es" label="Español" default />}
      </video>
      {resumedAt !== null && (
        <p className="text-xs text-muted-foreground" role="status">
          Continúas donde quedaste ({formatDuration(resumedAt)}).
        </p>
      )}
    </div>
  );
}
