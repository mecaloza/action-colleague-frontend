"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { mediaApi, mediaKeys } from "@/lib/api/media";
import { StatusPanel } from "./status-panel";

interface PendingAssetProps {
  assetId: string;
  /** What is happening, e.g. "Leyendo el documento…". */
  label: string;
  onReady: () => void;
  onDismiss: () => void;
}

/** Waits for an uploaded file to be processed, then reports back (or shows why it failed). */
export function PendingAsset({ assetId, label, onReady, onDismiss }: PendingAssetProps) {
  const asset = useQuery({
    queryKey: mediaKeys.asset(assetId),
    queryFn: () => mediaApi.get(assetId),
    refetchInterval: (query) => (query.state.data?.status === "ready" || query.state.data?.status === "failed" ? false : 1500),
  });
  const status = asset.data?.status;
  useEffect(() => {
    if (status === "ready") onReady();
  }, [status, onReady]);

  if (status === "failed") {
    return (
      <div role="alert" className="border-l-2 border-destructive bg-red-50 p-4 text-sm">
        <p>{asset.data?.error ?? "No pudimos procesar el archivo."}</p>
        <button type="button" onClick={onDismiss} className="mt-2 text-[11px] font-bold uppercase tracking-label text-accent">
          Elegir otro archivo
        </button>
      </div>
    );
  }
  return (
    <StatusPanel>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 animate-spin text-accent" /> {label}
      </p>
      <Progress indeterminate />
    </StatusPanel>
  );
}
