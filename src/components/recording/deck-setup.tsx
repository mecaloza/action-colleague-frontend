"use client";

import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Presentation, Video, type LucideIcon } from "lucide-react";
import { Dropzone } from "@/components/media/dropzone";
import { PendingAsset } from "@/components/media/pending-asset";
import { UploadProgress } from "@/components/media/upload-progress";
import { UPLOAD_RULES, mediaKeys } from "@/lib/api/media";
import type { MediaAsset } from "@/lib/api/types";
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
  /** For a choice that shows more below it: whether that part is open. */
  expanded?: boolean;
  disabled?: boolean;
}

function Choice({ icon: Icon, title, description, onClick, expanded, disabled }: ChoiceProps) {
  const id = useId();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      aria-expanded={expanded}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start gap-4 border p-6 text-left transition-colors disabled:opacity-40",
        expanded ? "border-accent bg-white/10" : "border-white/20 hover:border-white/60",
      )}
    >
      <Icon className="h-7 w-7 text-accent" />
      <span id={`${id}-title`} className="font-display text-2xl font-medium tracking-tightest">
        {title}
      </span>
      <span id={`${id}-description`} className="text-sm text-white/60">
        {description}
      </span>
    </button>
  );
}

/** Whether every page of a processed deck came with its image (`page_count` only comes from newer servers). */
function hasAllPages(asset: MediaAsset): boolean {
  return asset.pages.length > 0 && (typeof asset.page_count !== "number" || asset.page_count === asset.pages.length);
}

/** Before recording: camera only, or camera and the admin's slides (a PDF, one image per page). */
export function DeckSetup({ courseId, onReady, onBusyChange }: DeckSetupProps) {
  const queryClient = useQueryClient();
  const [withSlides, setWithSlides] = useState(false);
  const [deckId, setDeckId] = useState<string | null>(null);
  // Processed, but without the image of some page: it can't be presented as it is.
  const [incomplete, setIncomplete] = useState(false);
  const [checking, setChecking] = useState(false);
  const { state, busy, upload, cancel } = useUpload();
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const uploadDeck = async (file: File) => {
    const asset = await upload(file, { kind: "deck", courseId, purpose: "deck" });
    if (asset) setDeckId(asset.id);
  };

  const deckReady = (asset: MediaAsset) => {
    if (hasAllPages(asset)) onReady({ assetId: asset.id, pages: asset.pages });
    else setIncomplete(true);
  };

  // Asks for the deck again; PendingAsset then checks the fresh answer (unmounted meanwhile, hence "all").
  const checkAgain = async () => {
    if (!deckId) return;
    setChecking(true);
    await queryClient.invalidateQueries({ queryKey: mediaKeys.asset(deckId), refetchType: "all" });
    setChecking(false);
    setIncomplete(false);
  };

  const chooseAnother = () => {
    setIncomplete(false);
    setDeckId(null);
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
          description="Sube tu presentación en PDF y avanza las diapositivas mientras hablas: el video las muestra con tu cámara en una burbuja."
          onClick={() => setWithSlides(true)}
          expanded={withSlides}
        />
      </div>
      {withSlides && (
        <div className="max-w-xl text-ink-900">
          {incomplete ? (
            <div role="alert" className="border-l-2 border-destructive bg-red-50 p-4 text-sm">
              <p>No pudimos cargar tus diapositivas. Intenta de nuevo.</p>
              <div className="mt-2 flex gap-4 text-[11px] font-bold uppercase tracking-label text-accent">
                <button type="button" onClick={checkAgain} disabled={checking} className="disabled:opacity-40">
                  Intentar de nuevo
                </button>
                <button type="button" onClick={chooseAnother} disabled={checking} className="disabled:opacity-40">
                  Elegir otro archivo
                </button>
              </div>
            </div>
          ) : deckId ? (
            <PendingAsset
              assetId={deckId}
              label="Preparando tus diapositivas…"
              onReady={deckReady}
              onDismiss={() => setDeckId(null)}
            />
          ) : (
            !busy && (
              <div className="space-y-3">
                <Dropzone
                  rule={UPLOAD_RULES.deck}
                  label="Arrastra tu presentación en PDF o haz clic para elegirla"
                  onFile={uploadDeck}
                  className="bg-white"
                />
                <p className="text-xs text-white/60">¿Tienes PowerPoint o Keynote? Expórtala como PDF (hasta 150 páginas).</p>
              </div>
            )
          )}
          <UploadProgress state={state} onCancel={cancel} />
        </div>
      )}
    </div>
  );
}
