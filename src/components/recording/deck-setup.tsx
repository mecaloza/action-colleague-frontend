"use client";

import { useEffect, useState } from "react";
import { Presentation, Video, type LucideIcon } from "lucide-react";
import { Dropzone } from "@/components/media/dropzone";
import { PendingAsset } from "@/components/media/pending-asset";
import { UploadProgress } from "@/components/media/upload-progress";
import { UPLOAD_RULES } from "@/lib/api/media";
import { useUpload } from "@/lib/hooks/use-upload";
import { cn } from "@/lib/utils";

export interface Deck {
  assetId: string;
  /** One image per page, in order (signed URLs). */
  pages: string[];
}

interface DeckSetupProps {
  courseId: number;
  /** Called once the mode is chosen: with the prepared deck, or `null` for camera only. */
  onReady: (deck: Deck | null) => void;
  /** Whether the PDF is uploading: closing then would lose it. */
  onBusyChange?: (busy: boolean) => void;
}

interface ChoiceProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
}

function Choice({ icon: Icon, title, description, onClick, selected, disabled }: ChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start gap-4 border p-6 text-left transition-colors disabled:opacity-40",
        selected ? "border-accent bg-white/10" : "border-white/20 hover:border-white/60",
      )}
    >
      <Icon className="h-7 w-7 text-accent" />
      <span className="font-display text-2xl font-medium tracking-tightest">{title}</span>
      <span className="text-sm text-white/60">{description}</span>
    </button>
  );
}

/** Before recording: camera only, or camera and the admin's slides (a PDF, one image per page). */
export function DeckSetup({ courseId, onReady, onBusyChange }: DeckSetupProps) {
  const [withSlides, setWithSlides] = useState(false);
  const [deckId, setDeckId] = useState<string | null>(null);
  const { state, busy, upload, cancel } = useUpload();
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const uploadDeck = async (file: File) => {
    const asset = await upload(file, { kind: "deck", courseId, purpose: "deck" });
    if (asset) setDeckId(asset.id);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Choice
          icon={Video}
          title="Solo cámara"
          description="Hablas a cámara; el video es tu grabación."
          onClick={() => onReady(null)}
          disabled={busy}
        />
        <Choice
          icon={Presentation}
          title="Cámara y diapositivas"
          description="Sube tu presentación en PDF y cámbiala mientras hablas: el video muestra tus diapositivas con tu cámara en una burbuja."
          onClick={() => setWithSlides(true)}
          selected={withSlides}
        />
      </div>
      {withSlides && (
        <div className="max-w-xl text-ink-900">
          {deckId ? (
            <PendingAsset
              assetId={deckId}
              label="Preparando tus diapositivas…"
              onReady={(asset) => onReady({ assetId: asset.id, pages: asset.pages })}
              onDismiss={() => setDeckId(null)}
            />
          ) : (
            !busy && (
              <div className="space-y-3">
                <Dropzone
                  rule={UPLOAD_RULES.deck}
                  label="Arrastra tu presentación en PDF"
                  onFile={uploadDeck}
                  className="bg-white"
                />
                <p className="text-xs text-white/60">¿Tienes PowerPoint o Keynote? Expórtala como PDF.</p>
              </div>
            )
          )}
          <UploadProgress state={state} onCancel={cancel} />
        </div>
      )}
    </div>
  );
}
