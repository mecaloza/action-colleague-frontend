"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ImageOff, Loader2 } from "lucide-react";
import { studioApi } from "@/lib/api/studio";
import type { Slide, SlideContext } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}

/** What the server needs to render one slide. */
type PreviewRequest = { slide: Slide; context: SlideContext };

interface SlidePreviewProps extends PreviewRequest {
  className?: string;
  alt?: string;
}

/**
 * The slide exactly as the video will show it: rendered by the server with the same renderer.
 * While editing, the image follows the text after a short pause.
 */
export function SlidePreview({ slide, context, className, alt = "Vista previa de la diapositiva" }: SlidePreviewProps) {
  // The request travels as text: debounced, and also the query key, so each distinct slide is rendered once.
  const request = useDebouncedValue(JSON.stringify({ slide, context }), 400);
  const image = useQuery({
    queryKey: ["slides", "preview", request],
    queryFn: ({ signal }) => {
      const { slide: debouncedSlide, context: debouncedContext } = JSON.parse(request) as PreviewRequest;
      return studioApi.slidePreview(debouncedSlide, debouncedContext, signal);
    },
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData, // keep the last image on screen while the next one renders
  });
  const url = useObjectUrl(image.data);

  return (
    <div className={cn("relative aspect-video overflow-hidden bg-ink-900", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={alt} className="h-full w-full object-cover" />}
      {image.isFetching && (
        <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-white/70" aria-label="Actualizando vista previa" />
      )}
      {image.isError && !url && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-white/60">
          <ImageOff className="h-5 w-5" /> Sin vista previa
        </div>
      )}
    </div>
  );
}
