"use client";

import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ImageOff, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { studioApi } from "@/lib/api/studio";
import type { Slide, SlideContext } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

// The server renders two previews at a time and turns away (429) the ones that wait too long: a long script asks
// for every scene at once, so this tab sends two at most and queues the rest.
const MAX_RENDERS = 2;
let rendering = 0;
const waiting: (() => void)[] = [];

const cancelled = () => new DOMException("Cancelado", "AbortError");

/** Resolves when a render slot is free; rejects if `signal` aborts first (the slide changed or left the screen). */
function takeSlot(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(cancelled());
  if (rendering < MAX_RENDERS) {
    rendering += 1;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const start = () => {
      signal.removeEventListener("abort", cancel);
      rendering += 1;
      resolve();
    };
    const cancel = () => {
      const index = waiting.indexOf(start);
      if (index >= 0) waiting.splice(index, 1);
      reject(cancelled());
    };
    waiting.push(start);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

function releaseSlot() {
  rendering -= 1;
  waiting.shift()?.();
}

/** What the server needs to render one slide. */
type PreviewRequest = { slide: Slide; context: SlideContext };

async function renderPreview(request: string, signal: AbortSignal): Promise<Blob> {
  await takeSlot(signal);
  try {
    const { slide, context } = JSON.parse(request) as PreviewRequest;
    return await studioApi.slidePreview(slide, context, signal);
  } finally {
    releaseSlot();
  }
}

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

/** True once the element comes near the screen: slides further down a long script are rendered when scrolled to. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (seen || !element) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
    }, { rootMargin: "300px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen]);
  return { ref, seen };
}

interface SlidePreviewProps extends PreviewRequest {
  className?: string;
  alt?: string;
}

/**
 * The slide exactly as the video will show it: rendered by the server with the same renderer.
 * While editing, the image follows the text after a short pause.
 */
export function SlidePreview({ slide, context, className, alt = "Vista previa de la diapositiva" }: SlidePreviewProps) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  // The request travels as text: debounced, and also the query key, so each distinct slide is rendered once.
  const request = useDebouncedValue(JSON.stringify({ slide, context }), 400);
  const image = useQuery({
    queryKey: ["slides", "preview", request],
    queryFn: ({ signal }) => renderPreview(request, signal),
    enabled: seen,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData, // keep the last image on screen while the next one renders
    // 429: the server is busy with other previews (other tabs, other admins): wait a bit longer each time.
    retry: (failures, error) => error instanceof ApiError && error.status === 429 && failures < 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  // The last image that rendered: it stays on screen while the next one renders, and if that one fails.
  const [shown, setShown] = useState<Blob | undefined>(undefined);
  if (image.data && image.data !== shown) setShown(image.data);
  const url = useObjectUrl(shown);
  const failed = image.isError && !image.isFetching;
  const retry = (
    <button
      type="button"
      onClick={() => void image.refetch()}
      aria-label={`Reintentar: ${alt}`}
      className="font-bold uppercase tracking-label text-white underline-offset-2 hover:underline"
    >
      Reintentar
    </button>
  );

  return (
    <div ref={ref} className={cn("relative aspect-video overflow-hidden bg-ink-900", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={alt} className="h-full w-full object-cover" />}
      {image.isFetching && (
        <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-white/70" aria-label="Actualizando vista previa" />
      )}
      {failed &&
        (url ? (
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-black/75 px-3 py-1.5 text-[11px]">
            <span className="text-white/80">Vista previa desactualizada ·</span> {retry}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-white/60">
            <ImageOff className="h-5 w-5" /> Sin vista previa
            {retry}
          </div>
        ))}
    </div>
  );
}
