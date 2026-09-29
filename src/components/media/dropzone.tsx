"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { MB, mimeTypeOf, type UploadRule } from "@/lib/api/media";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  rule: UploadRule;
  /** Call to action, e.g. "Arrastra tu video o haz clic para elegirlo". */
  label: string;
  /** Replaces the rule's own hint under the label. */
  hint?: string;
  onFile: (file: File) => void;
  className?: string;
}

function matchesAccept(file: File, accept: string): boolean {
  const name = file.name.toLowerCase();
  const type = mimeTypeOf(file); // the same type the upload will declare (some systems leave `file.type` empty)
  return accept.split(",").some((entry) => {
    const pattern = entry.trim().toLowerCase();
    if (pattern.startsWith(".")) return name.endsWith(pattern);
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
    return type === pattern;
  });
}

/** Why the file cannot be uploaded, or null when it can. */
function rejectionOf(file: File, rule: UploadRule): string | null {
  if (!matchesAccept(file, rule.accept)) return "Este tipo de archivo no se admite aquí.";
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > rule.maxBytes) return `El archivo supera el máximo de ${Math.round(rule.maxBytes / MB)} MB.`;
  return null;
}

/** Drag-and-drop area that also opens the file picker; a file that breaks the rule is rejected with a toast. */
export function Dropzone({ rule, label, hint = rule.hint, onFile, className }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const rejection = rejectionOf(file, rule);
    if (rejection) toast.error(rejection);
    else onFile(file);
  };

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        // Moving over the icon or the text also fires dragleave: only leaving the area counts.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFile(event.dataTransfer.files[0]);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-colors",
        // The input is visually hidden: the area shows its keyboard focus.
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
        dragging ? "border-accent bg-accent-soft" : "border-input bg-mist/50 hover:border-ink-800",
        className,
      )}
    >
      <UploadCloud className={cn("h-8 w-8", dragging ? "text-accent" : "text-muted-foreground")} aria-hidden />
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <input
        type="file"
        accept={rule.accept}
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = ""; // choosing the same file again must trigger onChange
        }}
      />
    </label>
  );
}
