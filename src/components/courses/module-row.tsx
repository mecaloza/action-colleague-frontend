"use client";

import { useState } from "react";
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
import { PendingChangeBadge, StaleVideoNotice } from "@/components/studio/revision-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ModuleAdmin, ModuleSource } from "@/lib/api/types";
import { formatDuration, plural, twoDigits } from "@/lib/format";
import { useStableUrl } from "@/lib/hooks/use-stable-url";
import { cn } from "@/lib/utils";
import { MoveButtons } from "./move-buttons";

const SOURCE_META: Record<ModuleSource, { label: string; icon: LucideIcon }> = {
  ai: { label: "Video IA", icon: Sparkles },
  upload: { label: "Video", icon: Film },
  recording: { label: "Grabación", icon: Video },
  document: { label: "Documento", icon: FileText },
  text: { label: "Lectura", icon: FileText },
};

const hasContent = (module: ModuleAdmin) => Boolean(module.video || module.document || module.content_text.trim());

/** Something that went wrong with the module's media: a badge, and the reason it opens. */
interface Issue {
  variant: "destructive" | "warning";
  label: string;
  reason: string;
}

function issueOf(module: ModuleAdmin): Issue | null {
  if (module.generation_status === "failed") {
    const reason =
      module.generation_error ||
      (module.source === "ai" ? "La generación falló. Vuelve a intentarlo." : "El procesamiento falló. Vuelve a intentarlo.");
    return { variant: "destructive", label: "Error", reason };
  }
  if (module.generation_status === "queued" || module.generation_status === "generating" || !hasContent(module)) return null;
  // The AI video came out without something (e.g. its presenter): why.
  return module.video_warning ? { variant: "warning", label: "Aviso", reason: module.video_warning } : null;
}

function GenerationBadge({ module }: { module: ModuleAdmin }) {
  // Uploads and recordings are "processed"; AI modules are "generated".
  const busyLabel = module.source === "ai" ? "Generando" : "Procesando";
  if (module.generation_status === "queued") return <Badge variant="secondary" pulse>En cola</Badge>;
  if (module.generation_status === "generating") return <Badge variant="accent" pulse>{busyLabel}</Badge>;
  if (module.generation_status !== "failed" && !hasContent(module)) return <Badge variant="warning">Sin contenido</Badge>;
  return null;
}

interface ModuleRowProps {
  module: ModuleAdmin;
  index: number;
  total: number;
  /** Moves the module one place up (-1) or down (1): what dragging does, with a tap or a key. */
  onMove: (direction: -1 | 1) => void;
  /** A move is being saved: the arrows wait for it. */
  moving: boolean;
  onOpen: () => void;
  /** Asks the AI for a change to the module's script (AI modules with one), or opens the change waiting. */
  onRequestChange?: () => void;
  /** Produces the module's video again (the script changed since it was made). */
  onProduce?: () => void;
  producing?: boolean;
}

/** One row of the module list: dragged by its handle or moved with its arrows. */
export function ModuleRow({
  module,
  index,
  total,
  onMove,
  moving,
  onOpen,
  onRequestChange,
  onProduce,
  producing,
}: ModuleRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: module.id });
  const { label, icon: SourceIcon } = SOURCE_META[module.source] ?? SOURCE_META.text;
  const poster = useStableUrl(module.poster_url);
  const issue = issueOf(module);
  // A badge's reason opens under the row with a tap or a click: a tooltip never shows on a touch screen.
  const [showIssue, setShowIssue] = useState(false);
  const issueId = `module-${module.id}-issue`;
  // An AI module with a script: the AI can change it (on phones, from the module's panel).
  const scripted = module.source === "ai" && module.scene_count > 0;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group border border-border bg-white px-4 py-4 transition-shadow", isDragging && "relative z-10 shadow-2xl")}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-nowrap">
        <button
          className="-ml-2.5 flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground hover:text-ink-800 active:cursor-grabbing"
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
        {issue && (
          <button
            type="button"
            className="-my-2.5 inline-flex min-h-10 shrink-0 items-center"
            aria-expanded={showIssue}
            aria-controls={issueId}
            onClick={() => setShowIssue((shown) => !shown)}
          >
            <Badge variant={issue.variant}>
              <AlertTriangle className="h-3 w-3" /> {issue.label}
            </Badge>
            <span className="sr-only">: ver el motivo</span>
          </button>
        )}
        {scripted && onRequestChange && <PendingChangeBadge module={module} onReview={onRequestChange} />}
        {/* On phones the arrows go to a line of their own, at its end. */}
        <div className="ml-auto">
          <MoveButtons
            id={`module-${module.id}`}
            label={module.title}
            index={index}
            total={total}
            busy={moving}
            onMove={onMove}
          />
        </div>
        {/* Until lg only its icon fits the row (its name says what it does). */}
        {scripted && onRequestChange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRequestChange}
            className="hidden min-w-10 px-2.5 sm:inline-flex lg:px-4"
            aria-label={`Pedir un cambio al guion de ${module.title}`}
          >
            <Sparkles />
            <span className="hidden lg:inline">Pedir un cambio</span>
          </Button>
        )}
        {/* On phones the title opens the module; the row keeps room for it. */}
        <Button variant="outline" size="sm" onClick={onOpen} className="hidden sm:inline-flex" aria-label={`Editar ${module.title}`}>
          Editar
        </Button>
      </div>
      {scripted && <StaleVideoNotice module={module} onProduce={onProduce} producing={producing} className="mt-3" />}
      {issue && (
        <p
          id={issueId}
          className={cn(
            "mt-3 items-start gap-2 border-l-2 px-3 py-2 text-sm",
            showIssue ? "flex" : "hidden",
            issue.variant === "destructive" ? "border-destructive bg-red-50" : "border-warning bg-amber-50",
          )}
        >
          <AlertTriangle
            className={cn("mt-0.5 h-4 w-4 shrink-0", issue.variant === "destructive" ? "text-destructive" : "text-warning")}
          />
          {issue.reason}
        </p>
      )}
    </li>
  );
}
