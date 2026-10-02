import { useQuery } from "@tanstack/react-query";
import { studioApi, studioKeys } from "@/lib/api/studio";
import type { StudioCapabilities } from "@/lib/api/types";

/** Assumed until the server answers (or if the request fails): the studio stays usable and the API reports real limits. */
const ASSUME_ALL: StudioCapabilities = {
  ai: true,
  voice: true,
  avatar: true,
  storage: true,
  visuals: ["stock", "image", "clip"],
  max_clips: 2,
};

/** What the server has configured for the AI studio: AI, narration voice, presenter and storage. */
export function useStudioCapabilities(): StudioCapabilities {
  const { data } = useQuery({ queryKey: studioKeys.capabilities, queryFn: studioApi.capabilities });
  return data ?? ASSUME_ALL;
}
