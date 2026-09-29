"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { UploadProgress } from "@/components/media/upload-progress";
import { useUpload } from "@/lib/hooks/use-upload";
import { RecordingStudio } from "./recording-studio";
import type { Recording } from "./use-recorder";

interface RecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: number;
  moduleId: number;
  moduleTitle: string;
  onUploaded: () => void;
}

/** Full-screen studio: record with the camera, review, and upload as the module's video. */
export function RecordingDialog({ open, onOpenChange, courseId, moduleId, moduleTitle, onUploaded }: RecordingDialogProps) {
  const { state, busy, upload, cancel, reset } = useUpload();

  const handleFinish = async (recording: Recording) => {
    const asset = await upload(recording.blob, {
      filename: `grabacion.${recording.extension}`,
      kind: "recording",
      courseId,
      moduleId,
      purpose: "recording",
    });
    if (asset) {
      toast.success("Grabación subida. La estamos procesando; aparecerá en el módulo en unos minutos.");
      onUploaded();
      onOpenChange(false);
    }
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (busy) return; // closing mid-upload would lose the recording
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/90" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink-950 text-white"
        >
          <div className="container flex h-16 shrink-0 items-center justify-between">
            <div>
              <p className="eyebrow text-white/50">Grabarme</p>
              <DialogPrimitive.Title className="font-display text-lg font-medium">{moduleTitle}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              className="flex h-10 w-10 items-center justify-center disabled:opacity-40"
              aria-label="Cerrar estudio"
              disabled={busy}
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="container flex-1 space-y-4 pb-10">
            {open && <RecordingStudio slides={[]} onFinish={handleFinish} />}
            <div className="text-ink-900">
              <UploadProgress state={state} onCancel={cancel} />
            </div>
            <p className="text-xs text-white/50">
              Consejo: graba en un lugar silencioso y con luz de frente. Puedes pausar, repetir y revisar antes de usar la grabación.
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
