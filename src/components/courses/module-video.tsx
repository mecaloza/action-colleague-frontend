import type { ModuleAdmin } from "@/lib/api/types";

type VideoFields = Pick<ModuleAdmin, "video" | "poster_url" | "captions_url">;

/** Player for a module's video, with its Spanish captions. Renders nothing when there is no video. */
export function ModuleVideo({ module }: { module: VideoFields }) {
  const { video, poster_url: poster, captions_url: captions } = module;
  if (!video) return null;
  return (
    <video
      key={video.url}
      src={video.url}
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
