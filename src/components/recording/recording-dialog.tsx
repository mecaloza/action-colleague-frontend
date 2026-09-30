"use client";

import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { UploadProgress } from "@/components/media/upload-progress";
import { ApiError, errorMessage } from "@/lib/api/client";
import { mediaApi } from "@/lib/api/media";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { useReturnFocus } from "@/lib/hooks/use-return-focus";
import { useUpload } from "@/lib/hooks/use-upload";
import { type Deck, DeckSetup } from "./deck-setup";
import { RecordingStudio } from "./recording-studio";
import { fitTimeline, type Recording } from "./use-recorder";

/** Asking for the composition only queues it: no answer after this long means the connection hung. */
const COMPOSE_TIMEOUT_MS = 30_000;

/** A 409 because the server lost the upload (never confirmed, or failed): only uploading it again helps. */
function uploadLost(error: unknown): boolean {
  const detail = error instanceof ApiError && error.status === 409 ? error.detail : null;
  return typeof detail === "object" && detail !== null && "code" in detail && detail.code === "upload_not_ready";
}

interface RecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: number;
  moduleId: number;
  moduleTitle: string;
  onUploaded: () => void;
}

/**
 * Full-screen studio: choose camera only or camera and slides, record, review, and upload. With
 * slides, the server combines them with the camera at the exact times they were changed.
 */
export function RecordingDialog({ open, onOpenChange, courseId, moduleId, moduleTitle, onUploaded }: RecordingDialogProps) {
  const { state, busy: uploading, upload, cancel, reset } = useUpload();
  const confirm = useConfirm();
  const returnFocus = useReturnFocus(); // closing goes back to what opened the studio
  // undefined: still choosing; null: camera only.
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [deckUploading, setDeckUploading] = useState(false);
  const [composing, setComposing] = useState(false);
  // This take's recording once uploaded: if asking for the composition fails, trying again doesn't upload it again.
  const uploaded = useRef<{ blob: Blob; assetId: string } | null>(null);
  const busy = uploading || composing || deckUploading;
  // A countdown, a recording in progress or a take not used yet: closing now would lose it.
  const [hasTake, setHasTake] = useState(false);
  // Why asking for the composition failed, shown under the studio (a toast goes away).
  const [composeError, setComposeError] = useState<string | null>(null);

  // Reloading or closing the tab would lose the take, or what is being uploaded: the browser asks first.
  useUnsavedChangesWarning(open && (hasTake || busy));

  // A new take (after "Repetir") starts without the previous one's error.
  useEffect(() => {
    if (!hasTake) setComposeError(null);
  }, [hasTake]);

  // The dialog stays mounted between sessions: nothing chosen or recorded in this one may reach the next.
  const close = () => {
    reset();
    setDeck(undefined);
    setHasTake(false);
    setComposeError(null);
    uploaded.current = null;
    onOpenChange(false);
  };

  // The close button or Escape: never mid-upload, and a take not used yet is only dropped on purpose.
  const requestClose = async () => {
    if (busy) return; // closing mid-upload would lose the recording
    if (
      hasTake &&
      !(await confirm({
        title: "¿Descartar la grabación?",
        description: "Todavía no la usas en el módulo; si cierras el estudio, se pierde.",
        confirmLabel: "Descartar",
        destructive: true,
      }))
    )
      return;
    close();
  };

  const handleFinish = async (recording: Recording) => {
    setComposeError(null);
    const filename = `grabacion.${recording.extension}`;
    if (!deck) {
      const asset = await upload(recording.blob, { filename, kind: "recording", courseId, moduleId, purpose: "recording" });
      if (!asset) return;
      toast.success("Grabación subida. La estamos procesando; aparecerá en el módulo en unos minutos.");
    } else {
      // Not attached on its own: the composition (slides + camera) becomes the module's video.
      if (uploaded.current?.blob !== recording.blob) {
        const asset = await upload(recording.blob, { filename, kind: "recording", courseId });
        if (!asset) return;
        uploaded.current = { blob: recording.blob, assetId: asset.id };
      }
      setComposing(true);
      const controller = new AbortController();
      let timer = 0;
      // Also gives up while the request waits for a session refresh, which takes no signal.
      const timeLimit = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, COMPOSE_TIMEOUT_MS);
      });
      try {
        const composition = mediaApi.composeRecording(
          moduleId,
          {
            recording_asset_id: uploaded.current.assetId,
            deck_asset_id: deck.assetId,
            // Within the server's 2000 points, and the same on every try (it tells a retry from another take).
            timeline: fitTimeline(recording.timeline),
          },
          controller.signal,
        );
        await Promise.race([composition, timeLimit]);
      } catch (error) {
        if (uploadLost(error)) uploaded.current = null; // the next try uploads the take again
        const message = controller.signal.aborted ? "El servidor no respondió a tiempo. Intenta de nuevo." : errorMessage(error);
        setComposeError(message);
        toast.error(message);
        return;
      } finally {
        window.clearTimeout(timer);
        setComposing(false);
      }
      toast.success("Grabación subida. Estamos combinándola con tus diapositivas; aparecerá en el módulo en unos minutos.");
    }
    onUploaded();
    close();
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : void requestClose())}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/90" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink-950 text-white"
          {...returnFocus}
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
            {open &&
              (deck === undefined ? (
                <DeckSetup courseId={courseId} onReady={setDeck} onBusyChange={setDeckUploading} />
              ) : (
                <RecordingStudio
                  slides={deck?.pages ?? []}
                  onFinish={handleFinish}
                  locked={busy}
                  onTakeChange={setHasTake}
                />
              ))}
            {composeError && (
              <div role="alert" className="flex items-start gap-3 border-l-2 border-destructive bg-red-50 p-4 text-sm text-ink-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p>{composeError}</p>
              </div>
            )}
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
