"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LayoutWarning, LayoutWarningCode, SlideLayout, StoryboardScene } from "@/lib/api/types";
import { plural, twoDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export const isError = (warning: LayoutWarning) => warning.severity === "error";

function addTo(groups: Map<string, LayoutWarning[]>, key: string, warning: LayoutWarning) {
  groups.set(key, [...(groups.get(key) ?? []), warning]);
}

/** Each scene's warnings, by scene id. */
export function warningsByScene(warnings: LayoutWarning[]): Map<string, LayoutWarning[]> {
  const byScene = new Map<string, LayoutWarning[]>();
  for (const warning of warnings) addTo(byScene, warning.scene_id, warning);
  return byScene;
}

/** The fields the scene editor shows for each layout (`SlideFields`): a warning about another one is the scene's. */
const EDITOR_FIELDS: Record<SlideLayout, RegExp> = {
  cover: /^(title|subtitle)$/,
  bullets: /^(title|points\.\d+)$/,
  steps: /^(title|points\.\d+)$/,
  closing: /^(title|points\.\d+)$/,
  statement: /^(title|quote_author|icon)$/,
  stat: /^(stat_value|stat_label|subtitle|icon)$/,
  comparison: /^(title|(left|right)\.(heading|points\.\d+))$/,
  chart: /^(title|chart_(labels|values)\.\d+)$/,
  calculation: /^(title|points\.\d+|stat_value|stat_label)$/,
  case: /^(title|points\.[0-3])$/,
  visual: /^(title|visual)$/,
};

export interface SceneWarnings {
  /** The warnings about one of the editor's fields ("title", "points.2", "visual"...). */
  of: (field: string) => LayoutWarning[];
  /** The ones about no field the editor shows (a decoration of the layout): they are the whole scene's. */
  general: LayoutWarning[];
}

/** A scene's warnings, by the field of its editor they go next to. */
export function sceneWarnings(layout: SlideLayout, warnings: LayoutWarning[]): SceneWarnings {
  const byField = new Map<string, LayoutWarning[]>();
  const general: LayoutWarning[] = [];
  for (const warning of warnings) {
    // A figure without its meaning shows the title in its place: the admin fixes it by writing the meaning.
    const field = layout === "stat" && warning.field === "title" ? "stat_label" : warning.field;
    if (field === null || !EDITOR_FIELDS[layout].test(field)) general.push(warning);
    else addTo(byField, field, warning);
  }
  return { of: (field) => byField.get(field) ?? [], general };
}

const warningsId = (fieldId: string) => `${fieldId}-warnings`;

/**
 * The `aria-describedby` and `aria-invalid` of a field with these warnings (`FieldWarnings` under it): an error
 * marks it invalid; a mere warning (a word split in two) doesn't. `invalid`: what the field says of its own value.
 */
export function warnedField(fieldId: string, warnings: LayoutWarning[], invalid?: boolean) {
  const error = warnings.some(isError);
  return {
    "aria-describedby": warnings.length ? warningsId(fieldId) : undefined,
    "aria-invalid": invalid === undefined ? error || undefined : invalid || error,
  };
}

/** What doesn't fit or overlaps because of a field, said next to it (its description: see `warnedField`). */
export function FieldWarnings({
  fieldId,
  warnings,
  className,
}: {
  fieldId: string;
  warnings: LayoutWarning[];
  className?: string;
}) {
  if (!warnings.length) return null;
  return (
    <div id={warningsId(fieldId)} className={cn("mt-1.5 space-y-1", className)}>
      {warnings.map((warning) => (
        <p
          key={`${warning.code}:${warning.field}`}
          className={cn("flex items-start gap-1.5 text-xs", isError(warning) ? "text-destructive" : "text-warning")}
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {warning.message}
        </p>
      ))}
    </div>
  );
}

/** How many warnings a scene has, red if any is an error (something cut or overlapping). */
export function WarningsBadge({ warnings }: { warnings: LayoutWarning[] }) {
  if (!warnings.length) return null;
  return (
    <Badge variant={warnings.some(isError) ? "destructive" : "warning"}>
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {plural(warnings.length, "aviso")}
      <span className="sr-only"> de diseño</span>
    </Badge>
  );
}

/** The kinds of problem a summary counts, with how one and several of them are said. */
const KINDS: { codes: LayoutWarningCode[]; one: string; many: string }[] = [
  { codes: ["text_truncated"], one: "un texto que no cabe", many: "textos que no caben" },
  {
    codes: ["presenter_overlap", "motif_overlap", "frame_overlap", "text_overlap"],
    one: "un elemento encimado",
    many: "elementos encimados",
  },
  { codes: ["outside_safe_area"], one: "un elemento fuera de los márgenes", many: "elementos fuera de los márgenes" },
  { codes: ["word_broken"], one: "una palabra partida", many: "palabras partidas" },
  {
    codes: ["visual_under_presenter"],
    one: "la infografía tapada por el presentador",
    many: "la infografía tapada por el presentador",
  },
];

/** "2 escenas con textos que no caben", "1 escena con una palabra partida"...: one line per kind of problem. */
export function summaryLines(warnings: LayoutWarning[]): string[] {
  return KINDS.flatMap(({ codes, one, many }) => {
    const found = warnings.filter((warning) => codes.includes(warning.code));
    if (!found.length) return [];
    const scenes = new Set(found.map((warning) => warning.scene_id)).size;
    return [`${plural(scenes, "escena")} con ${found.length === 1 ? one : many}`];
  });
}

interface LayoutSummaryProps {
  warnings: LayoutWarning[];
  scenes: StoryboardScene[];
  /** A newer draft is being checked. */
  checking: boolean;
  /** The last check failed: the warnings shown are an older draft's. */
  failed: boolean;
  onRetry: () => void;
  /** Takes the admin to the scene (to the first field with a warning). */
  onShow: (sceneId: string) => void;
}

/** Above the scenes: what doesn't fit or overlaps in the whole script, with a way to each scene that has it. */
export function LayoutSummary({ warnings, scenes, checking, failed, onRetry, onShow }: LayoutSummaryProps) {
  // Warnings of scenes no longer in the draft (removed while it was being checked) don't count.
  const ids = new Set(scenes.map((scene) => scene.id));
  const current = warnings.filter((warning) => ids.has(warning.scene_id));
  const byScene = warningsByScene(current);
  const flagged = scenes
    .map((scene, index) => ({ scene, number: index + 1 }))
    .filter(({ scene }) => byScene.has(scene.id));
  const lines = summaryLines(current);
  const error = current.some(isError);
  return (
    <div className="space-y-2">
      {/* Read aloud when it changes: what the check of the draft found, or that it found nothing. */}
      <p role="status" className="sr-only">
        {lines.length ? `Avisos de diseño: ${lines.join(", ")}.` : "Sin avisos de diseño en las diapositivas."}
      </p>
      {lines.length > 0 && (
        <section
          aria-label="Avisos de diseño"
          className={cn(
            "border-l-2 px-4 py-3 text-sm",
            error ? "border-destructive bg-red-50" : "border-warning bg-amber-50",
          )}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className={cn("mt-0.5 h-4 w-4 shrink-0", error ? "text-destructive" : "text-warning")}
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-1">
              <ul className="space-y-0.5 font-semibold">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="flex items-center gap-2 text-muted-foreground">
                Revísalos antes de producir el video.
                {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Revisando el diseño" />}
              </p>
              <div className="flex flex-wrap items-center gap-x-4">
                <span className="text-muted-foreground">Ir a:</span>
                {flagged.map(({ scene, number }) => (
                  <Button key={scene.id} variant="link" className="text-[13px]" onClick={() => onShow(scene.id)}>
                    Escena {twoDigits(number)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      {failed && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          No se pudo revisar si los textos caben en las diapositivas.
          <Button variant="link" className="text-[13px]" onClick={onRetry}>
            Reintentar
          </Button>
        </p>
      )}
    </div>
  );
}
