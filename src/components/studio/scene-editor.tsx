"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Slide, SlideContext, SlideLayout, StoryboardScene } from "@/lib/api/types";
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
          icons={ICON_LAYOUTS.includes(slide.layout) ? slide.icons ?? [] : undefined}
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
export function SceneEditor({ scene, index, total, context, onChange, onMove, onDuplicate, onRemove }: SceneEditorProps) {
  const id = `scene-${scene.id}`;
  const slide = scene.slide;
  const setSlide = (changes: Partial<Slide>) => onChange({ ...scene, slide: { ...slide, ...changes } });
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
          context={context}
          alt={`Diapositiva de la escena ${index + 1}`}
          className="lg:sticky lg:top-24 lg:self-start"
        />
        <div className="space-y-4">
          <SlideFields id={id} slide={slide} onChange={setSlide} />
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
              {scene.narration.trim() ? `Unos ${seconds} s de voz` : "La voz lee este texto mientras se ve la diapositiva."}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
