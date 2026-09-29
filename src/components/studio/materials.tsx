"use client";

import { FileText, Loader2, TriangleAlert, X } from "lucide-react";
import { Dropzone } from "@/components/media/dropzone";
import { MB, UPLOAD_RULES } from "@/lib/api/media";
import type { MediaAsset } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const RULES = UPLOAD_RULES.document;

function formatSize(bytes: number): string {
  if (!bytes) return "";
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface MaterialRowProps {
  name: string;
  detail: string;
  state?: "processing" | "failed";
  onRemove?: () => void;
}

function MaterialRow({ name, detail, state, onRemove }: MaterialRowProps) {
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      {state === "processing" ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-label="Procesando" />
      ) : state === "failed" ? (
        <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" aria-label="Con error" />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className={cn("block truncate text-xs", state === "failed" ? "text-destructive" : "text-muted-foreground")}>
          {detail}
        </span>
      </span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Quitar ${name}`} className="text-muted-foreground hover:text-ink-800">
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

/** How an uploaded document shows up: still being read, read (characters found) or unreadable. */
function uploadedRow(asset: MediaAsset): Pick<MaterialRowProps, "state" | "detail"> {
  if (asset.status === "failed") return { state: "failed", detail: asset.error ?? "No pudimos leerlo" };
  if (asset.status === "ready") return { detail: `${(asset.text_chars ?? 0).toLocaleString("es")} caracteres leídos` };
  return { state: "processing", detail: "Leyendo el documento…" };
}

interface MaterialsFieldProps {
  /** Files chosen but not uploaded yet (the course doesn't exist yet). */
  staged?: File[];
  onStagedChange?: (files: File[]) => void;
  /** Materials already uploaded to the course. */
  uploaded?: MediaAsset[];
  /** Upload right away (existing course). */
  onUpload?: (file: File) => void;
  busy?: boolean;
}

/** Documents the AI reads to build the course: PDF, Word, PowerPoint or text. */
export function MaterialsField({ staged = [], onStagedChange, uploaded = [], onUpload, busy }: MaterialsFieldProps) {
  const add = (file: File) => {
    if (onUpload) return onUpload(file);
    if (staged.some((item) => item.name === file.name && item.size === file.size)) return;
    onStagedChange?.([...staged, file]);
  };
  const empty = !staged.length && !uploaded.length;
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-label text-ink-700">Materiales (opcional)</p>
      <Dropzone
        rule={RULES}
        hint={`${RULES.hint}. Puedes agregar varios.`}
        label="Arrastra manuales, políticas o presentaciones"
        disabled={busy}
        onFile={add}
        className="py-8"
      />
      {!empty && (
        <ul className="border border-border bg-white" aria-label="Materiales">
          {uploaded.map((asset) => (
            <MaterialRow key={asset.id} name={asset.original_filename ?? "Documento"} {...uploadedRow(asset)} />
          ))}
          {staged.map((file) => (
            <MaterialRow
              key={`${file.name}-${file.size}`}
              name={file.name}
              detail={`${formatSize(file.size)} · se sube al continuar`}
              onRemove={busy ? undefined : () => onStagedChange?.(staged.filter((item) => item !== file))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
