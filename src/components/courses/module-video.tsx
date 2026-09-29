import type { ModuleAdmin } from "@/lib/api/types";
import { useStableUrl } from "@/lib/hooks/use-stable-url";

type VideoFields = Pick<ModuleAdmin, "video" | "poster_url" | "captions_url">;

/** Player for a module's video, with its Spanish captions. Renders nothing when there is no video. */
export function ModuleVideo({ module }: { module: VideoFields }) {
  // Re-signed URLs of the same files must not restart the player on every refetch.
  const src = useStableUrl(module.video?.url);
  const poster = useStableUrl(module.poster_url);
  const captions = useStableUrl(module.captions_url);
  if (!src) return null;
  return (
    <video
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
