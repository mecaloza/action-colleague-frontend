"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SceneVisual, Slide, SlideContext, SlideLayout, StoryboardScene, VisualKind } from "@/lib/api/types";
import { twoDigits } from "@/lib/format";
import { IconPicker } from "./icon-picker";
import { ListEditor } from "./list-editor";
import { RowActions } from "./row-actions";
import { SlidePreview } from "./slide-preview";

const LAYOUTS: { value: SlideLayout; label: string }[] = [
  { value: "cover", label: "Portada" },
  { value: "bullets", label: "Viñetas" },
  { value: "steps", label: "Pasos" },
  { value: "statement", label: "Frase destacada" },
  { value: "stat", label: "Dato" },
  { value: "comparison", label: "Comparación" },
  { value: "closing", label: "Cierre" },
  { value: "visual", label: "Infografía" },
  { value: "chart", label: "Gráfica con datos" },
  { value: "calculation", label: "Cálculo paso a paso" },
  { value: "case", label: "Caso práctico" },
];

/** The four parts of a practical case, in order (its points). */
const CASE_PARTS = ["Situación", "Diagnóstico", "Solución", "Resultado"];
const MAX_BARS = 6;
const MAX_CHART_VALUE = 1e12; // the server's limit for a figure

/** The layouts whose points can carry an icon (the steps keep their numbers). */
const ICON_LAYOUTS: SlideLayout[] = ["bullets", "closing"];

/** The layouts whose slide lists short phrases, and what that list is called. */
const POINTS_LABEL: Partial<Record<SlideLayout, string>> = {
  bullets: "Viñetas",
  steps: "Pasos",
  closing: "Para recordar",
  calculation: "Pasos del cálculo",
};

/** The two columns of a comparison slide. */
const SIDES = [
  { side: "left", heading: "Encabezado izquierdo", placeholder: "Antes", column: "Columna izquierda" },
  { side: "right", heading: "Encabezado derecho", placeholder: "Después", column: "Columna derecha" },
] as const;

const VISUAL_KINDS: { value: VisualKind; label: string }[] = [
  { value: "none", label: "Solo diseño (sin imagen)" },
  { value: "stock", label: "Video real de banco" },
  { value: "image", label: "Imagen generada con IA" },
  { value: "clip", label: "Clip animado con IA" },
];

/** Whether this clip fits in the module's cap, and how many more the module may use. */
function clipsHint(fits: boolean, more: number): string {
  if (!fits) return "El módulo ya no admite más clips: este saldrá como imagen.";
  if (more < 0) return "El módulo pasa del límite de clips: los últimos saldrán como imagen.";
  if (more === 0) return "Con este, el módulo usa todos sus clips.";
  return `El módulo admite ${more} ${more === 1 ? "clip más" : "clips más"}.`;
}

/** The scene's visual as its layout allows it: an infographic for "visual", anything else for the rest. */
export function sceneVisual(layout: SlideLayout, visual: SceneVisual | undefined): SceneVisual {
  const current = visual ?? NO_VISUAL;
  if (layout === "visual")
    return current.kind === "infographic" ? current : { ...current, kind: "infographic", query: "" };
  return current.kind === "infographic" ? NO_VISUAL : current;
}

export const NO_VISUAL: SceneVisual = { kind: "none", query: "", prompt: "" };

/** The slide fields that hold a single line of text. */
type SlideTextField = "title" | "subtitle" | "stat_value" | "stat_label" | "quote_author";

const WORDS_PER_SECOND = 2.5; // a calm narration pace

/** Reading time of a narration, as the voice will say it. */
export function narrationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / WORDS_PER_SECOND);
}

/**
 * A figure as people write it: "80,000" or "80.000" (thousands), "1,5" or "1.5" (decimals), "1.250.000,75".
 * With both separators the last one is the decimal one; a lone separator followed by exactly three digits groups
 * thousands. Anything else that isn't a number is NaN.
 */
export function parseNumber(text: string): number {
  let clean = text.trim().replace(/\s/g, "");
  if (!clean) return NaN;
  const separators = clean.match(/[.,]/g) ?? [];
  const last = Math.max(clean.lastIndexOf("."), clean.lastIndexOf(","));
  const grouped = new Set(separators).size === 1 && (separators.length > 1 || /^-?[1-9]\d{0,2}[.,]\d{3}$/.test(clean));
  if (grouped) clean = clean.replace(/[.,]/g, "");
  else if (separators.length) clean = clean.slice(0, last).replace(/[.,]/g, "") + "." + clean.slice(last + 1);
  return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : NaN;
}

const usableNumber = (number: number) => Number.isFinite(number) && Math.abs(number) <= MAX_CHART_VALUE;

/**
 * A figure typed as text (so "-", "" or "1,5" can be typed on the way): only a finite number reaches the slide,
 * and the field says when what is written isn't one.
 */
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (parseNumber(text) !== value) setText(String(value)); // changed elsewhere (e.g. a bar above was removed)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the value changes, not while typing
  }, [value]);
  const invalid = !usableNumber(parseNumber(text));
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const number = parseNumber(event.target.value);
        if (usableNumber(number)) onChange(number);
      }}
      onBlur={() => invalid && setText(String(value))} // what is left written is what is saved
      aria-invalid={invalid}
      className="w-32"
    />
  );
}

/** A chart's bars: a label and its exact value each, plus their unit. */
function ChartFields({ id, slide, onChange }: SlideFieldsProps) {
  const labels = slide.chart_labels ?? [];
  const values = slide.chart_values ?? [];
  const rows = labels.slice(0, MAX_BARS).map((label, index) => ({ label, value: values[index] ?? 0 }));
  const add = useRef<HTMLButtonElement>(null);
  const set = (next: { label: string; value: number }[]) =>
    onChange({ chart_labels: next.map((row) => row.label), chart_values: next.map((row) => row.value) });
  const setRow = (index: number, changes: Partial<{ label: string; value: number }>) =>
    set(rows.map((row, at) => (at === index ? { ...row, ...changes } : row)));
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-[11px] font-bold uppercase tracking-label text-ink-700">Barras</legend>
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            aria-label={`Barra ${index + 1}: qué mide`}
            value={row.label}
            onChange={(event) => setRow(index, { label: event.target.value })}
            placeholder="Presión correcta"
            maxLength={80}
          />
          <NumberField
            label={`Barra ${index + 1}: valor`}
            value={row.value}
            onChange={(value) => setRow(index, { value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Quitar barra ${index + 1}`}
            onClick={() => {
              set(rows.filter((_, at) => at !== index));
              add.current?.focus(); // the row (and this button) is gone
            }}
          >
            <X />
          </Button>
        </div>
      ))}
      {rows.length < MAX_BARS && (
        <Button
          ref={add}
          type="button"
          variant="link"
          className="text-[13px]"
          onClick={() => set([...rows, { label: "", value: 0 }])}
        >
          <Plus className="h-4 w-4" /> Agregar barra
        </Button>
      )}
      <div>
        <Label htmlFor={`${id}-chart-unit`}>Unidad</Label>
        <Input
          id={`${id}-chart-unit`}
          value={slide.chart_unit ?? ""}
          onChange={(event) => onChange({ chart_unit: event.target.value })}
          placeholder="km"
          maxLength={40}
        />
      </div>
    </fieldset>
  );
}

interface SlideFieldsProps {
  /** Prefix of the fields' ids, unique per scene. */
  id: string;
  slide: Slide;
  onChange: (changes: Partial<Slide>) => void;
}

/** The texts of a slide: which fields there are depends on its layout. */
function SlideFields({ id, slide, onChange }: SlideFieldsProps) {
  const textField = (field: SlideTextField, label: string, max = 300) => (
    <div>
      <Label htmlFor={`${id}-${field}`}>{label}</Label>
      <Input
        id={`${id}-${field}`}
        value={slide[field]}
        onChange={(event) => onChange({ [field]: event.target.value })}
        maxLength={max}
      />
    </div>
  );
  const pointsLabel = POINTS_LABEL[slide.layout];
  const iconField = (label: string) => (
    <div className="flex items-center gap-3">
      <IconPicker value={slide.icon ?? ""} onChange={(icon) => onChange({ icon })} label={label} />
      <span className="text-sm text-muted-foreground">Ícono (opcional)</span>
    </div>
  );

  return (
    <>
      {slide.layout === "stat" ? (
        <>
          {textField("stat_value", "Dato (número o cifra corta)", 40)}
          {textField("stat_label", "Qué significa")}
          {textField("subtitle", "Contexto (opcional)")}
          {iconField("el dato")}
        </>
      ) : slide.layout === "case" ? (
        <>
          {textField("title", "Título del caso")}
          {CASE_PARTS.map((part, index) => (
            <div key={part}>
              <Label htmlFor={`${id}-case-${index}`}>{part}</Label>
              <Textarea
                id={`${id}-case-${index}`}
                value={slide.points[index] ?? ""}
                onChange={(event) => {
                  // Points past the four parts stay (another layout may show them again).
                  const points = [...slide.points];
                  while (points.length < CASE_PARTS.length) points.push("");
                  points[index] = event.target.value;
                  onChange({ points });
                }}
                maxLength={300}
                className="min-h-[60px]"
              />
            </div>
          ))}
        </>
      ) : slide.layout === "chart" ? (
        <>
          {textField("title", "Título de la gráfica")}
          <ChartFields id={id} slide={slide} onChange={onChange} />
        </>
      ) : slide.layout === "visual" ? (
        textField("title", "Tema de la infografía")
      ) : slide.layout === "statement" ? (
        <>
          <div>
            <Label htmlFor={`${id}-title`}>Frase</Label>
            <Textarea
              id={`${id}-title`}
              value={slide.title}
              onChange={(event) => onChange({ title: event.target.value })}
              maxLength={300}
              className="min-h-[72px]"
            />
          </div>
          {textField("quote_author", "Autor o fuente (opcional)", 60)}
          {iconField("la frase")}
        </>
      ) : (
        <>
          {textField("title", "Título")}
          {slide.layout === "cover" && textField("subtitle", "Subtítulo")}
        </>
      )}
      {pointsLabel && (
        <ListEditor
          label={pointsLabel}
          values={slide.points}
          onChange={(points, icons) => onChange(icons ? { points, icons } : { points })}
          placeholder="Frase corta"
          max={5}
          maxLength={slide.layout === "calculation" ? 200 : 160}
          icons={ICON_LAYOUTS.includes(slide.layout) ? (slide.icons ?? []) : undefined}
          onIconsChange={ICON_LAYOUTS.includes(slide.layout) ? (icons) => onChange({ icons }) : undefined}
        />
      )}
      {slide.layout === "calculation" && (
        <>
          {textField("stat_value", "Resultado (cifra)", 40)}
          {textField("stat_label", "Qué significa el resultado")}
        </>
      )}
      {slide.layout === "comparison" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {SIDES.map(({ side, heading, placeholder, column }) => (
            <div key={side} className="space-y-2">
              <Input
                aria-label={heading}
                value={slide[side].heading}
                onChange={(event) => onChange({ [side]: { ...slide[side], heading: event.target.value } })}
                placeholder={placeholder}
                maxLength={80}
              />
              <ListEditor
                label={column}
                values={slide[side].points}
                onChange={(points) => onChange({ [side]: { ...slide[side], points } })}
                placeholder="Punto"
                max={4}
                maxLength={120}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** An infographic scene draws its picture from the description (the server makes it when the script is saved). */
function InfographicFields({
  id,
  visual,
  onChange,
}: {
  id: string;
  visual: SceneVisual;
  onChange: (changes: Partial<SceneVisual>) => void;
}) {
  const missing = !visual.prompt.trim();
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-infographic`}>Qué explica la infografía</Label>
      <Textarea
        id={`${id}-infographic`}
        value={visual.prompt}
        onChange={(event) => onChange({ prompt: event.target.value })}
        placeholder="Corte de una llanta con la presión correcta, baja y alta: dónde se desgasta la banda en cada caso, con sus rótulos"
        maxLength={1200}
        className="min-h-[96px]"
        aria-invalid={missing}
        aria-describedby={`${id}-infographic-hint`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id={`${id}-infographic-hint`}
          className={missing ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
        >
          {missing
            ? "Describe qué debe mostrar: sin eso la escena sale solo con su título."
            : "Se dibuja al guardar el guion, con los rótulos en español; tarda alrededor de un minuto."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={missing}
          onClick={() => onChange({ variant: ((visual.variant ?? 0) + 1) % 100 })}
        >
          <RefreshCw /> Otra versión
        </Button>
        {(visual.variant ?? 0) > 0 && (
          <span className="w-full text-right text-xs text-muted-foreground">Versión {(visual.variant ?? 0) + 1}</span>
        )}
      </div>
    </div>
  );
}

interface SceneEditorProps {
  /** The kinds of visual the server can find or generate. */
  visuals: VisualKind[];
  /** Animated clips this scene may still use (the module's cap minus the other scenes' clips). */
  clipsLeft: number;
  /** False for a clip past the module's cap (e.g. a duplicated scene): the server makes it an image. */
  clipFits: boolean;
  scene: StoryboardScene;
  index: number;
  total: number;
  context: SlideContext;
  /** The course the scene belongs to: its prepared infographics are shown in the preview. */
  courseId: number;
  onChange: (scene: StoryboardScene) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

/** One scene: its slide (with the video's own preview) and what the voice says over it. */
export function SceneEditor({
  visuals,
  clipsLeft,
  clipFits,
  scene,
  index,
  total,
  context,
  courseId,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: SceneEditorProps) {
  const id = `scene-${scene.id}`;
  const slide = scene.slide;
  const setSlide = (changes: Partial<Slide>) => onChange({ ...scene, slide: { ...slide, ...changes } });
  const infographic = slide.layout === "visual";
  // An infographic scene's picture is its content (always an infographic); other layouts may have a decorative
  // background (never an infographic, which would clash with their text).
  const visual = sceneVisual(slide.layout, scene.visual);
  const setVisual = (changes: Partial<SceneVisual>) => onChange({ ...scene, visual: { ...visual, ...changes } });
  // Switching to an infographic and back (or the other way) brings back what the scene had.
  const setAside = useRef<SceneVisual | null>(null);
  const setLayout = (layout: SlideLayout) => {
    if ((layout === "visual") === infographic) return setSlide({ layout });
    const previous = setAside.current;
    setAside.current = visual;
    onChange({ ...scene, slide: { ...slide, layout }, visual: sceneVisual(layout, previous ?? NO_VISUAL) });
  };
  const missingText = visual.kind === "stock" ? !visual.query.trim() : visual.kind !== "none" && !visual.prompt.trim();
  const seconds = narrationSeconds(scene.narration);

  return (
    <li className="border border-border bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className="font-display text-xl font-medium text-accent">{twoDigits(index + 1)}</span>
        <div className="w-44">
          <Select
            aria-label={`Diseño de la escena ${index + 1}`}
            value={slide.layout}
            onChange={(event) => setLayout(event.target.value as SlideLayout)}
            className="h-9"
          >
            {LAYOUTS.map((layout) => {
              const unavailable = layout.value === "visual" && !infographic && !visuals.includes("infographic");
              return (
                <option key={layout.value} value={layout.value} disabled={unavailable}>
                  {layout.label}
                  {unavailable ? " (no configurado)" : ""}
                </option>
              );
            })}
          </Select>
        </div>
        <RowActions
          noun="escena"
          index={index}
          total={total}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      </header>
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <SlidePreview
          slide={slide}
          context={{ ...context, backdrop: visual.kind !== "none" }}
          visual={
            (visual.kind === "infographic" || visual.kind === "image") && visual.prompt.trim() ? visual : undefined
          }
          courseId={courseId}
          alt={`Diapositiva de la escena ${index + 1}`}
          className="lg:sticky lg:top-24 lg:self-start"
        />
        <div className="space-y-4">
          <SlideFields id={id} slide={slide} onChange={setSlide} />
          {infographic ? (
            <div className="border-t border-border pt-4">
              <InfographicFields id={id} visual={visual} onChange={setVisual} />
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <Label htmlFor={`${id}-visual`}>Visual de fondo</Label>
                <Select
                  id={`${id}-visual`}
                  value={visual.kind}
                  onChange={(event) => setVisual({ kind: event.target.value as VisualKind })}
                  aria-describedby={`${id}-visual-hint`}
                >
                  {VISUAL_KINDS.map((kind) => {
                    const unavailable = kind.value !== "none" && !visuals.includes(kind.value);
                    const capped = kind.value === "clip" && clipsLeft <= 0 && visual.kind !== "clip";
                    return (
                      <option key={kind.value} value={kind.value} disabled={unavailable || capped}>
                        {kind.label}
                        {unavailable ? " (no configurado)" : capped ? " (ya usaste los clips del módulo)" : ""}
                      </option>
                    );
                  })}
                </Select>
              </div>
              {visual.kind === "stock" && (
                <div>
                  <Label htmlFor={`${id}-visual-query`}>Qué buscar (en inglés)</Label>
                  <Input
                    id={`${id}-visual-query`}
                    value={visual.query}
                    onChange={(event) => setVisual({ query: event.target.value })}
                    placeholder="truck tire workshop"
                    maxLength={120}
                    aria-invalid={missingText}
                    aria-describedby={`${id}-visual-hint`}
                  />
                </div>
              )}
              {(visual.kind === "image" || visual.kind === "clip") && (
                <div>
                  <Label htmlFor={`${id}-visual-prompt`}>Qué debe mostrar (en inglés)</Label>
                  <Textarea
                    id={`${id}-visual-prompt`}
                    value={visual.prompt}
                    onChange={(event) => setVisual({ prompt: event.target.value })}
                    placeholder="Air slowly escaping from a truck tire valve, close-up"
                    maxLength={600}
                    className="min-h-[72px]"
                    aria-invalid={missingText}
                    aria-describedby={`${id}-visual-hint`}
                  />
                </div>
              )}
              <p
                id={`${id}-visual-hint`}
                className={missingText ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
              >
                {missingText
                  ? "Escribe qué buscar o qué mostrar: sin eso la escena sale sin visual."
                  : visual.kind === "none"
                    ? "La escena se ve con el diseño de marca."
                    : visual.kind === "clip"
                      ? `Se genera al producir el video. ${clipsHint(clipFits, clipsLeft - 1)}`
                      : "Se busca o se genera al producir el video; la vista previa usa un fondo de muestra."}
              </p>
            </div>
          )}
          <div>
            <Label htmlFor={`${id}-narration`}>Narración</Label>
            <Textarea
              id={`${id}-narration`}
              value={scene.narration}
              onChange={(event) => onChange({ ...scene, narration: event.target.value })}
              maxLength={4000}
              className="min-h-[140px]"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {scene.narration.trim()
                ? `Unos ${seconds} s de voz`
                : "La voz lee este texto mientras se ve la diapositiva."}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
