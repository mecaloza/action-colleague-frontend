"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ZoneSpec {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  is_problem: boolean;
  explanation: string;
  placed: boolean;
}

const MIN_SIZE = 0.03;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

/** A rectangle the server accepts: rounded, at least MIN_SIZE wide and tall, wholly inside the picture. */
function fitted({ x, y, w, h }: Pick<ZoneSpec, "x" | "y" | "w" | "h">) {
  const width = round(clamp(w, MIN_SIZE, 1));
  const height = round(clamp(h, MIN_SIZE, 1));
  return {
    w: width,
    h: height,
    x: Math.min(round(clamp(x, 0, 1)), round(1 - width)),
    y: Math.min(round(clamp(y, 0, 1)), round(1 - height)),
  };
}

type Drag = { index: number; mode: "move" | "resize"; startX: number; startY: number; zone: ZoneSpec };

interface ZoneEditorProps {
  imageUrl: string | null;
  zones: ZoneSpec[];
  onChange: (zones: ZoneSpec[]) => void;
}

/**
 * Where each zone is on the picture: drag a zone to move it, its corner to resize it. A zone the admin moved
 * (or confirmed) is "placed": the AI only guessed a ninth of the picture, so an inspection is published only
 * once every zone is placed.
 */
export function ZoneEditor({ imageUrl, zones, onChange }: ZoneEditorProps) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState(0);

  const update = (index: number, changes: Partial<ZoneSpec>) =>
    onChange(zones.map((zone, at) => (at === index ? { ...zone, ...changes } : zone)));

  const start = (event: React.PointerEvent, index: number, mode: Drag["mode"]) => {
    event.preventDefault();
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    setSelected(index);
    setDrag({ index, mode, startX: event.clientX, startY: event.clientY, zone: zones[index] });
  };

  const moveTo = (event: React.PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const dx = (event.clientX - drag.startX) / rect.width;
    const dy = (event.clientY - drag.startY) / rect.height;
    const { zone } = drag;
    update(drag.index, {
      ...fitted(
        drag.mode === "move"
          ? { ...zone, x: zone.x + dx, y: zone.y + dy }
          : { ...zone, w: zone.w + dx, h: zone.h + dy },
      ),
      placed: true,
    });
  };

  const add = () => {
    const ids = new Set(zones.map((zone) => zone.id));
    let number = zones.length + 1;
    while (ids.has(`z${number}`)) number += 1;
    onChange([
      ...zones,
      {
        id: `z${number}`,
        label: "Nueva zona",
        x: 0.4,
        y: 0.4,
        w: 0.2,
        h: 0.2,
        is_problem: false,
        explanation: "Por qué está bien o mal.",
        placed: true,
      },
    ]);
    setSelected(zones.length);
  };

  const zone = zones[selected];
  return (
    <div className="space-y-4">
      <div
        ref={box}
        onPointerMove={moveTo}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onLostPointerCapture={() => setDrag(null)}
        className="relative w-full touch-none select-none overflow-hidden border border-border bg-ink-900"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL
          <img src={imageUrl} alt="Imagen de la inspección" className="block h-auto w-full" draggable={false} />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-white/60">Sin imagen todavía</div>
        )}
        {zones.map((item, index) => (
          <div
            key={item.id}
            onPointerDown={(event) => start(event, index, "move")}
            role="button"
            tabIndex={0}
            aria-label={`Zona ${item.label}${item.placed ? "" : " (sin ubicar)"}`}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setSelected(index);
            }}
            className={cn(
              "absolute cursor-move border-2",
              item.is_problem ? "border-success bg-success/20" : "border-destructive bg-destructive/20",
              !item.placed && "border-dashed",
              selected === index && "ring-2 ring-accent",
            )}
            style={{
              left: `${item.x * 100}%`,
              top: `${item.y * 100}%`,
              width: `${item.w * 100}%`,
              height: `${item.h * 100}%`,
            }}
          >
            <span className="absolute left-0 top-0 bg-ink-950/85 px-1 text-[11px] font-semibold text-white">
              {item.label}
            </span>
            <span
              onPointerDown={(event) => start(event, index, "resize")}
              className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-white bg-accent"
              aria-hidden
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Verde: hay un problema · rojo: está bien (distractor) · borde punteado: la IA solo adivinó dónde está. Arrastra
        la zona para moverla y su esquina para cambiar el tamaño.
      </p>

      <div className="flex flex-wrap gap-2">
        {zones.map((item, index) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={selected === index ? "default" : "outline"}
            onClick={() => setSelected(index)}
          >
            {item.label}
          </Button>
        ))}
        {zones.length < 8 && (
          <Button type="button" size="sm" variant="ghost" onClick={add}>
            <Plus /> Zona
          </Button>
        )}
      </div>

      {zone && (
        <fieldset className="space-y-3 border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Zona seleccionada</legend>
          <div>
            <Label htmlFor="zone-label">Nombre</Label>
            <Input
              id="zone-label"
              value={zone.label}
              maxLength={80}
              onChange={(event) => update(selected, { label: event.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={zone.is_problem}
              onChange={(event) => update(selected, { is_problem: event.target.checked })}
            />
            Aquí hay un problema (si no, es un distractor)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(["x", "y", "w", "h"] as const).map((field) => (
              <div key={field}>
                <Label htmlFor={`zone-${field}`}>
                  {{ x: "Izquierda %", y: "Arriba %", w: "Ancho %", h: "Alto %" }[field]}
                </Label>
                <Input
                  id={`zone-${field}`}
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(zone[field] * 100)}
                  onChange={(event) =>
                    update(selected, {
                      ...fitted({ ...zone, [field]: Number(event.target.value) / 100 }),
                      placed: true,
                    })
                  }
                />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={zone.placed}
              onChange={(event) => update(selected, { placed: event.target.checked })}
            />
            Ubicada sobre la imagen
          </label>
          <div>
            <Label htmlFor="zone-explanation">Explicación (se dice con voz)</Label>
            <Textarea
              id="zone-explanation"
              value={zone.explanation}
              maxLength={600}
              onChange={(event) => update(selected, { explanation: event.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={zones.length <= 3}
            onClick={() => {
              onChange(zones.filter((_, at) => at !== selected));
              setSelected(0);
            }}
          >
            <Trash2 /> Quitar zona
          </Button>
        </fieldset>
      )}
    </div>
  );
}
