"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic } from "lucide-react";
import { Dropzone } from "@/components/media/dropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MB, type UploadRule } from "@/lib/api/media";
import { studioApi } from "@/lib/api/studio";
import type { Voice } from "@/lib/api/types";
import { toastError } from "@/lib/notify";

const SAMPLE_RULE: UploadRule = {
  accept: "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/webm,.mp3,.wav,.m4a,.webm",
  maxBytes: 10 * MB,
  hint: "MP3, WAV, M4A o WEBM de hasta 10 MB",
};

const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  webm: "audio/webm",
};

/** Some systems give no type (or a generic one) to an audio file: the API only takes audio, so it's named from the extension. */
function withAudioType(file: File): File {
  if (file.type.startsWith("audio/") || file.type === "video/webm" || file.type === "video/mp4") return file;
  const type = AUDIO_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""];
  return type ? new File([file], file.name, { type }) : file;
}

interface CloneVoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloned: (voice: Voice) => void;
}

/** A voice made from a recording of the admin (or whoever authorizes it) to narrate the courses. */
export function CloneVoiceDialog({ open, onOpenChange, onCloned }: CloneVoiceDialogProps) {
  const [name, setName] = useState("");
  const [sample, setSample] = useState<File | null>(null);
  const clone = useMutation({
    mutationFn: () => studioApi.cloneVoice(name.trim(), sample!),
    onSuccess: (voice) => {
      toast.success(`Voz «${voice.name}» lista`);
      onCloned(voice);
      setName("");
      setSample(null);
      onOpenChange(false);
    },
    onError: toastError,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !clone.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Clonar una voz</DialogTitle>
          <DialogDescription>
            Sube 1 a 2 minutos de audio de una sola persona hablando con naturalidad, sin música ni ruido. Usa solo voces que
            tengas permiso de clonar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label htmlFor="voice-name">Nombre de la voz</Label>
            <Input id="voice-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Ej. Laura — Talento humano" />
          </div>
          {sample ? (
            <p className="flex items-center justify-between gap-3 border border-border bg-mist/60 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Mic className="h-4 w-4 shrink-0 text-accent" />
                <span className="truncate">{sample.name}</span>
              </span>
              <button type="button" className="text-[11px] font-bold uppercase tracking-label text-accent" onClick={() => setSample(null)}>
                Cambiar
              </button>
            </p>
          ) : (
            <Dropzone
              rule={SAMPLE_RULE}
              label="Arrastra la grabación o haz clic para elegirla"
              onFile={(file) => setSample(withAudioType(file))}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={clone.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => clone.mutate()} disabled={!name.trim() || !sample} loading={clone.isPending}>
            Clonar voz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
