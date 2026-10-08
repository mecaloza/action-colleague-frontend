"use client";

import { useId, type ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type {
  CourseDetail,
  IgnoredChange,
  ModuleAdmin,
  ReadingChange,
  RevisionChanges,
  RevisionImpact,
  SceneChange,
  SceneChangeAction,
  StoryboardScene,
  TextOp,
  VisualKind,
} from "@/lib/api/types";
import { plural, twoDigits } from "@/lib/format";
import { slideIcon } from "@/lib/slide-icons";
import { cn } from "@/lib/utils";
import { LAYOUTS, sceneVisual } from "./scene-editor";
import { SlidePreview } from "./slide-preview";
import { videoStyle } from "./steps";

const LAYOUT_LABELS = new Map<string, string>(LAYOUTS.map(({ value, label }) => [value, label]));

/** The fields of a scene a change can touch, in the order they are shown, named as in the scene editor. */
const FIELDS: [name: string, label: string][] = [
  ["layout", "Diseño"],
  ["eyebrow", "Antetítulo"],
  ["title", "Título"],
  ["subtitle", "Subtítulo"],
  ["points", "Puntos"],
  ["icons", "Íconos de los puntos"],
  ["icon", "Ícono"],
  ["stat", "Dato"],
  ["quote", "Autor o fuente"],
  ["comparison", "Comparación"],
  ["chart", "Gráfica"],
  ["visual", "Visual"],
  ["narration", "Narración"],
];
const KNOWN_FIELDS = new Set(FIELDS.map(([name]) => name));

const VISUAL_LABELS: Record<VisualKind, string> = {
  none: "Sin visual (solo el diseño)",
  stock: "Video real de banco",
  image: "Imagen generada con IA",
  clip: "Clip animado con IA",
  infographic: "Infografía",
};

const ACTIONS: Record<SceneChangeAction, { label: string; variant: BadgeProps["variant"] }> = {
  update: { label: "Cambia", variant: "accent" },
  insert: { label: "Escena nueva", variant: "success" },
  delete: { label: "Se quita", variant: "destructive" },
  move: { label: "Cambia de lugar", variant: "secondary" },
};

const NUMBER = new Intl.NumberFormat("es");

// A field's values come as the server stores them: read without trusting their shape (an old scene may lack some).
const textOf = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const listOf = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String(item ?? "")) : []);
const recordOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** What the admin knows a scene by: its title (or its figure, its first heading), else its layout. */
export function sceneTitle(scene: StoryboardScene | null | undefined): string {
  const slide = scene?.slide;
  if (!slide) return "";
  const named = textOf(slide.title) || textOf(slide.stat_value) || textOf(slide.left?.heading);
  return named || LAYOUT_LABELS.get(slide.layout) || "";
}

function Blank() {
  return <span className="italic text-muted-foreground">Vacío</span>;
}

function Points({ items }: { items: string[] }) {
  if (!items.some((item) => item.trim())) return <Blank />;
  return (
    <ol className="list-decimal space-y-0.5 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item.trim() || <Blank />}</li>
      ))}
    </ol>
  );
}

/** One side of a comparison: its heading and points. */
function Column({ side, value }: { side: string; value: unknown }) {
  const column = recordOf(value);
  return (
    <div>
      <p className="font-semibold">
        {side}: {textOf(column.heading) || <Blank />}
      </p>
      <Points items={listOf(column.points)} />
    </div>
  );
}

/** A field's value as the admin reads it in the editor (`name`: see `SceneChange.fields`). */
function FieldValue({ name, value }: { name: string; value: unknown }) {
  switch (name) {
    case "layout":
      return <>{LAYOUT_LABELS.get(textOf(value)) ?? (textOf(value) || <Blank />)}</>;
    case "points":
      return <Points items={listOf(value)} />;
    case "icons": {
      const icons = listOf(value);
      if (!icons.length) return <Blank />;
      return <>{icons.map((icon) => slideIcon(icon)?.label ?? "Sin ícono").join(" · ")}</>;
    }
    case "icon":
      return <>{slideIcon(textOf(value))?.label ?? "Sin ícono"}</>;
    case "stat": {
      const stat = recordOf(value);
      if (!textOf(stat.stat_value) && !textOf(stat.stat_label)) return <Blank />;
      return (
        <>
          <span className="font-semibold">{textOf(stat.stat_value)}</span> {textOf(stat.stat_label)}
        </>
      );
    }
    case "comparison": {
      const comparison = recordOf(value);
      return (
        <div className="space-y-2">
          <Column side="Izquierda" value={comparison.left} />
          <Column side="Derecha" value={comparison.right} />
        </div>
      );
    }
    case "chart": {
      const chart = recordOf(value);
      const labels = listOf(chart.chart_labels);
      const values = Array.isArray(chart.chart_values) ? chart.chart_values : [];
      const unit = textOf(chart.chart_unit);
      if (!labels.length) return <Blank />;
      return (
        <ul className="space-y-0.5">
          {labels.map((label, index) => {
            const figure = values[index];
            return (
              <li key={index}>
                {label || <Blank />}: {typeof figure === "number" ? NUMBER.format(figure) : "—"}
                {unit && ` ${unit}`}
              </li>
            );
          })}
        </ul>
      );
    }
    case "visual": {
      const visual = recordOf(value);
      const kind = (textOf(visual.kind) || "none") as VisualKind;
      const variant = typeof visual.variant === "number" ? visual.variant : 0;
      const described = textOf(visual.prompt) || textOf(visual.query);
      return (
        <>
          <span className="font-semibold">
            {VISUAL_LABELS[kind] ?? kind}
            {kind !== "none" && variant > 0 && ` · versión ${variant + 1}`}
          </span>
          {kind !== "none" && described && <span className="mt-0.5 block text-muted-foreground">{described}</span>}
        </>
      );
    }
    default:
      return <>{textOf(value) || <Blank />}</>;
  }
}

/** A value before or after the change. */
function Side({ when, children }: { when: "before" | "after"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "min-w-0 border-l-2 px-3 py-2 text-sm",
        when === "before" ? "border-red-300 bg-red-50/70" : "border-success bg-green-50",
      )}
    >
      <p className="mb-1 text-[10px] font-bold uppercase tracking-label text-muted-foreground">
        {when === "before" ? "Antes" : "Después"}
      </p>
      <div className="break-words">{children}</div>
    </div>
  );
}

/** Before and after side by side (stacked on a phone); a scene added or removed has only one of them. */
function Compare({ before, after }: { before?: ReactNode; after?: ReactNode }) {
  return (
    <div className={cn("grid gap-2", before !== undefined && after !== undefined && "sm:grid-cols-2")}>
      {before !== undefined && <Side when="before">{before}</Side>}
      {after !== undefined && <Side when="after">{after}</Side>}
    </div>
  );
}

/** The narration word by word: what is added underlined in green, what is removed struck through in red. */
function NarrationDiff({ parts }: { parts: TextOp[] }) {
  return (
    <p className="whitespace-pre-wrap break-words border-l-2 border-border bg-white px-3 py-2 text-sm leading-relaxed">
      {parts.map((part, index) =>
        part.op === "insert" ? (
          <ins key={index} className="bg-green-100 text-green-900 decoration-green-700/60 underline-offset-2">
            <span className="sr-only">[agregado: </span>
            {part.text}
            <span className="sr-only">]</span>
          </ins>
        ) : part.op === "delete" ? (
          <del key={index} className="bg-red-100 text-red-900 decoration-red-700/70">
            <span className="sr-only">[quitado: </span>
            {part.text}
            <span className="sr-only">]</span>
          </del>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

const fieldLabel = (name: string) => FIELDS.find(([field]) => field === name)?.[1] ?? name;

/** A scene's slide as the video draws it, before or after the change. */
type ScenePreview = (scene: StoryboardScene, when: "before" | "after", number: number) => ReactNode;

function SceneChangeCard({ change, preview }: { change: SceneChange; preview: ScenePreview }) {
  const headingId = useId();
  const { action, position, fields } = change;
  const number = position.after ?? position.before ?? 0;
  const look = ACTIONS[action] ?? ACTIONS.update;
  const names = [
    ...FIELDS.map(([name]) => name).filter((name) => name in fields),
    ...Object.keys(fields).filter((name) => !KNOWN_FIELDS.has(name)),
  ];
  const before = action === "insert" ? undefined : change.before;
  const after = action === "delete" ? undefined : change.after;
  // The slide is drawn when something on it changed (a narration alone looks the same).
  const slideChanged = names.some((name) => name !== "narration");
  const elsewhere = position.before !== null && position.after !== null && position.before !== position.after;
  return (
    <li aria-labelledby={headingId} className="border border-border bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <span className="font-display text-xl font-medium text-accent" aria-hidden>
          {twoDigits(number)}
        </span>
        <h4 id={headingId} className="min-w-0 flex-1 basis-40 break-words font-semibold">
          <span className="sr-only">Escena {number}: </span>
          {sceneTitle(change.after ?? change.before) || "Escena sin título"}
        </h4>
        <Badge variant={look.variant}>{look.label}</Badge>
      </header>
      <div className="space-y-4 p-4">
        {change.reason && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-ink-800">Por qué: </span>
            {change.reason}
          </p>
        )}
        {/* A scene added or removed before it changes its number too: said, without calling it a move. */}
        {elsewhere && (
          <p className="text-sm">
            {action === "move"
              ? `Pasa de la escena ${position.before} a la ${position.after}.`
              : `Ahora es la escena ${position.after} (antes, la ${position.before}).`}
          </p>
        )}
        {slideChanged && (before || after) && (
          <Compare
            before={before ? preview(before, "before", position.before ?? number) : undefined}
            after={after ? preview(after, "after", position.after ?? number) : undefined}
          />
        )}
        {names.map((name) => {
          const field = fields[name];
          return (
            <div key={name}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-label text-ink-700">{fieldLabel(name)}</p>
              {name === "narration" && action === "update" && change.narration_diff.length ? (
                <NarrationDiff parts={change.narration_diff} />
              ) : (
                <Compare
                  before={action === "insert" ? undefined : <FieldValue name={name} value={field.before} />}
                  after={action === "delete" ? undefined : <FieldValue name={name} value={field.after} />}
                />
              )}
            </div>
          );
        })}
      </div>
    </li>
  );
}

function ReadingCard({ reading }: { reading: ReadingChange }) {
  const headingId = useId();
  const text = (value: string) =>
    value.trim() ? <div className="whitespace-pre-wrap leading-relaxed">{value.trim()}</div> : <Blank />;
  return (
    <li aria-labelledby={headingId} className="border border-border bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <BookOpen className="h-5 w-5 shrink-0 text-accent" aria-hidden />
        <h4 id={headingId} className="min-w-0 flex-1 font-semibold">
          Lectura del módulo
        </h4>
        <Badge variant="accent">Cambia</Badge>
      </header>
      <div className="p-4">
        <Compare before={text(reading.before)} after={text(reading.after)} />
      </div>
    </li>
  );
}

interface RevisionDiffProps {
  course: CourseDetail;
  module: ModuleAdmin;
  changes: RevisionChanges;
  /** How many scenes the saved script has (the counter on the previews); unknown while it loads. */
  sceneCount?: number;
}

/** What a change does to the script, scene by scene (slides before and after), and to the module's reading. */
export function RevisionDiff({ course, module, changes, sceneCount }: RevisionDiffProps) {
  const headingId = useId();
  const added = changes.scenes.filter((change) => change.action === "insert").length;
  const removed = changes.scenes.filter((change) => change.action === "delete").length;
  const last = (when: "before" | "after") => Math.max(0, ...changes.scenes.map((change) => change.position[when] ?? 0));
  const totals = {
    before: sceneCount ?? last("before"),
    after: sceneCount === undefined ? last("after") : sceneCount + added - removed,
  };
  const preview: ScenePreview = (scene, when, number) => {
    const visual = sceneVisual(scene.slide.layout, scene.visual);
    const drawn = (visual.kind === "infographic" || visual.kind === "image") && (visual.prompt ?? "").trim();
    return (
      <SlidePreview
        slide={scene.slide}
        context={{
          course_title: course.title,
          module_label: `Módulo ${module.order}`,
          index: number,
          total: Math.max(totals[when], number),
          ...videoStyle(course.settings),
          backdrop: visual.kind !== "none",
        }}
        visual={drawn ? visual : undefined}
        courseId={course.id}
        alt={`Escena ${number} ${when === "before" ? "antes del cambio" : "con el cambio"}`}
      />
    );
  };
  const narrationDiff = changes.scenes.some((change) => change.action === "update" && change.narration_diff.length);
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h4 id={headingId} className="text-[11px] font-bold uppercase tracking-label text-ink-700">
        Qué cambia
      </h4>
      {narrationDiff && (
        <p className="text-xs text-muted-foreground">
          En la narración, lo <ins className="bg-green-100 text-green-900 underline-offset-2">subrayado en verde</ins>{" "}
          se agrega y lo <del className="bg-red-100 text-red-900">tachado en rojo</del> se quita.
        </p>
      )}
      <ol className="space-y-3">
        {changes.scenes.map((change) => (
          <SceneChangeCard key={`${change.action}:${change.scene_id}`} change={change} preview={preview} />
        ))}
        {changes.reading && <ReadingCard reading={changes.reading} />}
      </ol>
    </section>
  );
}

/** What the AI proposed that was left out (another scene than the chosen ones, one that doesn't exist...), and why. */
export function IgnoredChanges({ ignored, numbers }: { ignored: IgnoredChange[]; numbers: Map<string, number> }) {
  if (!ignored.length) return null;
  return (
    <div className="border-l-2 border-ink-500 bg-mist px-4 py-3 text-sm">
      <p className="font-semibold">La IA también propuso cambios que quedaron fuera:</p>
      <ul className="mt-1.5 space-y-1">
        {ignored.map((item, index) => {
          const number = numbers.get(item.scene_id);
          const what = number
            ? `Escena ${twoDigits(number)}`
            : item.action === "insert_after"
              ? "Una escena nueva"
              : "Una escena";
          return (
            <li key={index} className="break-words">
              <span className="font-semibold">{what}:</span> {item.reason}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "a, b y c". */
function joined(parts: string[]): string {
  return parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/** What producing the video again takes after the change, in plain Spanish (one sentence per line). */
function impactLines(impact: RevisionImpact | null, hasVideo: boolean): string[] {
  if (!hasVideo) return ["El módulo aún no tiene video: el cambio se verá cuando lo produzcas."];
  if (!impact?.needs_render) return ["No hace falta volver a producir el video: el cambio no toca sus escenas."];
  const parts: string[] = [];
  const narrated = impact.narration_scenes.length;
  if (narrated) {
    const verb = narrated === 1 ? "se vuelve" : "se vuelven";
    parts.push(`${verb} a narrar ${plural(narrated, "escena")} (≈ ${NUMBER.format(impact.narration_chars)} caracteres)`);
  }
  if (impact.presenter_takes === 1) parts.push("se graba de nuevo 1 toma del presentador");
  else if (impact.presenter_takes > 1) parts.push(`se graban de nuevo ${impact.presenter_takes} tomas de los presentadores`);
  if (impact.visuals_to_make === 1) parts.push("se genera 1 visual nuevo");
  else if (impact.visuals_to_make > 1) parts.push(`se generan ${impact.visuals_to_make} visuales nuevos`);
  const lines = [
    parts.length
      ? `${capitalized(joined(parts))}.`
      : "Solo cambian las diapositivas: la narración y el presentador quedan igual.",
  ];
  if (impact.reassigns_presenters) {
    lines.push("Como cambia el número de escenas, los presentadores se turnan distinto desde ese punto.");
  }
  lines.push("El video sigue como está hasta que lo vuelvas a producir.");
  return lines;
}

/** What the change means for the module's video: what producing it again takes, or why it isn't needed. */
export function RevisionImpactPanel({ impact, hasVideo }: { impact: RevisionImpact | null; hasVideo: boolean }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-1 border border-border bg-mist/60 px-4 py-3 text-sm">
      <h4 id={headingId} className="mb-1.5 text-[11px] font-bold uppercase tracking-label text-ink-700">
        Para el video
      </h4>
      {impactLines(impact, hasVideo).map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}
