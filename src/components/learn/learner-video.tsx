"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { learnApi, learnKeys } from "@/lib/api/learn";
import type { LearnerCourseDetail, LearnerModule } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { useStableUrl } from "@/lib/hooks/use-stable-url";

const SAVE_EVERY_SECONDS = 15;
const CAPTION_LABELS: Record<string, string> = { es: "Español", en: "English", pt: "Português" };
const RESUME_MIN_SECONDS = 5; // closer to the start than this, starting over is nicer
const RESUME_TAIL_SECONDS = 10; // closer to the end than this, the video was watched

/** The module's video: resumes where the learner left it and keeps that position saved. */
export function LearnerVideo({ module, language = "es" }: { module: LearnerModule; language?: string }) {
  const queryClient = useQueryClient();
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
      // Coming back to this module later in the session resumes here, not where the page first loaded it.
      queryClient.setQueriesData<LearnerCourseDetail>({ queryKey: learnKeys.all }, (data) =>
        data?.modules
          ? { ...data, modules: data.modules.map((item) => (item.id === module.id ? { ...item, last_position_seconds: Math.floor(seconds) } : item)) }
          : data,
      );
    },
    [module.id, queryClient],
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
    const hidden = () => document.visibilityState === "hidden" && leave(); // e.g. switching apps on a phone
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
    };
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
        {captions && <track kind="subtitles" src={captions} srcLang={language} label={CAPTION_LABELS[language] ?? "Subtítulos"} default />}
      </video>
      {resumedAt !== null && (
        <p className="text-xs text-muted-foreground" role="status">
          Retomas donde lo dejaste ({formatDuration(resumedAt)}).
        </p>
      )}
    </div>
  );
}
