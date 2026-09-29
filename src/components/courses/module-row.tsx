"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  FileText,
  Film,
  GripVertical,
  HelpCircle,
  MonitorPlay,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModuleAdmin, ModuleSource } from "@/lib/api/types";
import { formatDuration, plural, twoDigits } from "@/lib/format";
import { useStableUrl } from "@/lib/hooks/use-stable-url";
import { cn } from "@/lib/utils";

const SOURCE_META: Record<ModuleSource, { label: string; icon: LucideIcon }> = {
  ai: { label: "Video IA", icon: Sparkles },
  upload: { label: "Video", icon: Film },
  recording: { label: "Grabación", icon: Video },
  document: { label: "Documento", icon: FileText },
  text: { label: "Lectura", icon: FileText },
};

interface ReasonBadgeProps {
  variant: "destructive" | "warning";
  label: string;
  reason: string;
}

/** A badge whose reason shows in a tooltip. */
function ReasonBadge({ variant, label, reason }: ReasonBadgeProps) {
  return (
    <Tooltip>
      {/* A button, so the reason also shows with the keyboard and on touch. */}
      <TooltipTrigger type="button">
        <Badge variant={variant}>
          <AlertTriangle className="h-3 w-3" /> {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function GenerationBadge({ module }: { module: ModuleAdmin }) {
  // Uploads and recordings are "processed"; AI modules are "generated".
  const busyLabel = module.source === "ai" ? "Generando" : "Procesando";
  if (module.generation_status === "queued") return <Badge variant="secondary" pulse>En cola</Badge>;
  if (module.generation_status === "generating") return <Badge variant="accent" pulse>{busyLabel}</Badge>;
  if (module.generation_status === "failed")
    return (
      <ReasonBadge
        variant="destructive"
        label="Error"
        reason={
          module.generation_error ||
          (module.source === "ai" ? "La generación falló. Vuelve a intentarlo." : "El procesamiento falló. Vuelve a intentarlo.")
        }
      />
    );
  if (!module.video && !module.document && !module.content_text.trim())
    return <Badge variant="warning">Sin contenido</Badge>;
  // The AI video came out without something (e.g. its presenter): why.
  if (module.video_warning) return <ReasonBadge variant="warning" label="Aviso" reason={module.video_warning} />;
  return null;
}

/** One draggable row of the module list. */
export function ModuleRow({ module, onOpen }: { module: ModuleAdmin; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: module.id });
  const { label, icon: SourceIcon } = SOURCE_META[module.source] ?? SOURCE_META.text;
  const poster = useStableUrl(module.poster_url);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex flex-wrap items-center gap-x-4 gap-y-2 border border-border bg-white px-4 py-4 transition-shadow sm:flex-nowrap",
        isDragging && "relative z-10 shadow-2xl",
      )}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-ink-800 active:cursor-grabbing"
        aria-label={`Reordenar ${module.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="w-8 shrink-0 font-display text-2xl font-medium text-accent">{twoDigits(module.order)}</span>
      <div className="relative hidden h-14 w-24 shrink-0 overflow-hidden bg-ink-900 sm:block">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40">
            <SourceIcon className="h-5 w-5" />
          </div>
        )}
        {module.video && <MonitorPlay className="absolute bottom-1 right-1 h-4 w-4 text-white drop-shadow" />}
      </div>
      <button onClick={onOpen} className="min-w-0 flex-1 basis-40 text-left">
        <p className="truncate font-semibold group-hover:text-accent">{module.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SourceIcon className="h-3.5 w-3.5" /> {label}
          </span>
          {module.duration_seconds ? <span>{formatDuration(module.duration_seconds)}</span> : null}
          {module.evaluation ? (
            <span className="inline-flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" /> {plural(module.evaluation.question_count, "pregunta")}
            </span>
          ) : (
            <span>Sin evaluación</span>
          )}
        </p>
      </button>
      <GenerationBadge module={module} />
      {/* On phones the title opens the module; the row keeps room for it. */}
      <Button variant="outline" size="sm" onClick={onOpen} className="hidden sm:inline-flex" aria-label={`Editar ${module.title}`}>
        Editar
      </Button>
    </li>
  );
}
