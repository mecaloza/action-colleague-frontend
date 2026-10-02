"use client";

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
];

/** The layouts whose points can carry an icon (the steps keep their numbers). */
const ICON_LAYOUTS: SlideLayout[] = ["bullets", "closing"];

/** The layouts whose slide lists short phrases, and what that list is called. */
const POINTS_LABEL: Partial<Record<SlideLayout, string>> = {
  bullets: "Viñetas",
  steps: "Pasos",
  closing: "Para recordar",
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

export const NO_VISUAL: SceneVisual = { kind: "none", query: "", prompt: "" };

/** The slide fields that hold a single line of text. */
type SlideTextField = "title" | "subtitle" | "stat_value" | "stat_label" | "quote_author";

const WORDS_PER_SECOND = 2.5; // a calm narration pace

/** Reading time of a narration, as the voice will say it. */
export function narrationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / WORDS_PER_SECOND);
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
          maxLength={160}
          icons={ICON_LAYOUTS.includes(slide.layout) ? (slide.icons ?? []) : undefined}
          onIconsChange={ICON_LAYOUTS.includes(slide.layout) ? (icons) => onChange({ icons }) : undefined}
        />
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

interface SceneEditorProps {
  /** The kinds of visual the server can find or generate. */
  visuals: VisualKind[];
  /** Animated clips this scene may still use (the module's cap minus the other scenes' clips). */
  clipsLeft: number;
  scene: StoryboardScene;
  index: number;
  total: number;
  context: SlideContext;
  onChange: (scene: StoryboardScene) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

/** One scene: its slide (with the video's own preview) and what the voice says over it. */
export function SceneEditor({
  visuals,
  clipsLeft,
  scene,
  index,
  total,
  context,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: SceneEditorProps) {
  const id = `scene-${scene.id}`;
  const slide = scene.slide;
  const setSlide = (changes: Partial<Slide>) => onChange({ ...scene, slide: { ...slide, ...changes } });
  const visual = scene.visual ?? NO_VISUAL;
  const setVisual = (changes: Partial<SceneVisual>) => onChange({ ...scene, visual: { ...visual, ...changes } });
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
            onChange={(event) => setSlide({ layout: event.target.value as SlideLayout })}
            className="h-9"
          >
            {LAYOUTS.map((layout) => (
              <option key={layout.value} value={layout.value}>
                {layout.label}
              </option>
            ))}
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
          alt={`Diapositiva de la escena ${index + 1}`}
          className="lg:sticky lg:top-24 lg:self-start"
        />
        <div className="space-y-4">
          <SlideFields id={id} slide={slide} onChange={setSlide} />
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
                    ? `Se genera al producir el video. Clips disponibles en el módulo: ${Math.max(clipsLeft, 0)}.`
                    : "Se busca o se genera al producir el video; la vista previa usa un fondo de muestra."}
            </p>
          </div>
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
