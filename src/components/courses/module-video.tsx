"use client";

import { useEffect, useRef } from "react";
import type { ModuleAdmin } from "@/lib/api/types";
import { useStableUrl } from "@/lib/hooks/use-stable-url";

type VideoFields = Pick<ModuleAdmin, "video" | "poster_url" | "captions_url">;

interface ModuleVideoProps {
  module: VideoFields;
  /** Seconds into the video it opens at (e.g. what the video's review found there). */
  startAt?: number;
}

/** Player for a module's video, with its Spanish captions. Renders nothing when there is no video. */
export function ModuleVideo({ module, startAt }: ModuleVideoProps) {
  // Re-signed URLs of the same files must not restart the player on every refetch.
  const src = useStableUrl(module.video?.url);
  const poster = useStableUrl(module.poster_url);
  const captions = useStableUrl(module.captions_url);
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = player.current;
    if (!video || startAt == null) return;
    const seek = () => {
      video.currentTime = startAt;
    };
    // Before the player knows the video this is where it starts once it does; sought again then, all the same.
    seek();
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [startAt, src]);
  if (!src) return null;
  return (
    <video
      ref={player}
      key={src.split("?")[0]}
      src={src}
      poster={poster ?? undefined}
      controls
      preload="metadata"
      crossOrigin={captions ? "anonymous" : undefined}
      className="aspect-video w-full bg-black"
    >
      {captions && <track kind="subtitles" src={captions} srcLang="es" label="Español" default />}
    </video>
  );
}
