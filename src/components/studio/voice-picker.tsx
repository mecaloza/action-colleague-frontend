"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pause, Play, Plus } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { studioApi, studioKeys } from "@/lib/api/studio";
import type { Language, Voice } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { CloneVoiceDialog } from "./clone-voice-dialog";

const GENDERS: Record<string, string> = { female: "Femenina", male: "Masculina", neutral: "Neutra" };

/** One audio element for every preview: starting a sample stops the one playing. */
function usePreviewPlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = (id: string, url: string) => {
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.onended = () => setPlaying(null);
    }
    if (playing === id) {
      audio.current.pause();
      setPlaying(null);
      return;
    }
    audio.current.src = url;
    void audio.current.play().then(() => setPlaying(id), () => setPlaying(null));
  };
  return { playing, toggle };
}

interface VoiceCardProps {
  voice: Voice;
  selected: boolean;
  playing: boolean;
  onSelect: () => void;
  onPreview?: () => void;
}

function VoiceCard({ voice, selected, playing, onSelect, onPreview }: VoiceCardProps) {
  const meta = [
    GENDERS[voice.gender] ?? voice.gender,
    voice.accent,
    voice.category === "cloned" ? "Clonada" : "",
  ].filter(Boolean);
  return (
    <li
      className={cn(
        "flex items-center gap-3 border bg-white px-4 py-3 transition-colors",
        selected ? "border-ink-800" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center border",
            selected ? "border-accent bg-accent text-white" : "border-input",
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{voice.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{meta.join(" · ") || "Voz"}</span>
        </span>
      </button>
      {onPreview && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onPreview}
          aria-label={playing ? `Detener ${voice.name}` : `Escuchar ${voice.name}`}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
      )}
    </li>
  );
}

interface VoicePickerProps {
  /** The course's language: its voices are listed first. */
  language: Language;
  selectedId: string | undefined;
  onSelect: (voice: Voice) => void;
}

/** The voices that can narrate the course (with a sample to listen to) and the way to clone a new one. */
export function VoicePicker({ language, selectedId, onSelect }: VoicePickerProps) {
  const queryClient = useQueryClient();
  const voices = useQuery({ queryKey: studioKeys.voices, queryFn: studioApi.voices });
  const { playing, toggle } = usePreviewPlayer();
  const [cloning, setCloning] = useState(false);
  // Voices in the course's language first; the rest keep the API's order (voices without a language stay in the list).
  const inLanguage = (voice: Voice) => Number(voice.language === language);
  const sortedVoices = (voices.data ?? []).slice().sort((a, b) => inLanguage(b) - inLanguage(a));

  return (
    <>
      {voices.isPending ? (
        <Skeleton className="h-48" />
      ) : voices.error ? (
        <QueryError query={voices} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sortedVoices.map((voice) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              selected={voice.id === selectedId}
              playing={playing === voice.id}
              onSelect={() => onSelect(voice)}
              onPreview={voice.preview_url ? () => toggle(voice.id, voice.preview_url) : undefined}
            />
          ))}
        </ul>
      )}
      <Button variant="link" className="mt-4" onClick={() => setCloning(true)}>
        <Plus className="h-4 w-4" /> Clonar una voz
      </Button>
      <CloneVoiceDialog
        open={cloning}
        onOpenChange={setCloning}
        onCloned={(cloned) => {
          queryClient.setQueryData<Voice[]>(studioKeys.voices, (list) => [cloned, ...(list ?? [])]);
          onSelect(cloned);
        }}
      />
    </>
  );
}
