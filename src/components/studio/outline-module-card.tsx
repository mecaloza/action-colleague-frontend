"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { OutlineModule } from "@/lib/api/types";
import { twoDigits } from "@/lib/format";
import { ListEditor } from "./list-editor";
import { RowActions } from "./row-actions";

const MIN_MINUTES = 1;
const MAX_MINUTES = 60;

/** The minutes typed in the field, kept within range (blank or invalid counts as the minimum). */
const clampMinutes = (raw: string) =>
  Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(Number(raw)) || MIN_MINUTES));

/** The typed minutes when they are already a valid length, or null while they aren't (e.g. halfway through typing). */
function validMinutes(raw: string): number | null {
  const minutes = Number(raw);
  return raw.trim() && Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES ? minutes : null;
}

export const blankModule = (): OutlineModule => ({
  title: "",
  summary: "",
  objectives: [],
  key_points: [],
  estimated_minutes: 5,
  include_quiz: true,
});

interface ModuleCardProps {
  module: OutlineModule;
  index: number;
  total: number;
  onChange: (module: OutlineModule) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

/** One module of the proposal: title, summary, key points, length and whether it ends with a quiz. */
export function ModuleCard({ module, index, total, onChange, onMove, onRemove }: ModuleCardProps) {
  const id = `outline-module-${index}`;
  const set = <K extends keyof OutlineModule>(key: K, value: OutlineModule[K]) => onChange({ ...module, [key]: value });
  // The minutes as typed, while the field has focus: checked (and brought within range) when it loses it.
  const [minutesText, setMinutesText] = useState<string | null>(null);
  return (
    <li className="border border-border bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <span className="font-display text-2xl font-medium text-accent">{twoDigits(index + 1)}</span>
        <span className="text-[11px] font-bold uppercase tracking-label text-muted-foreground">
          Módulo · {module.estimated_minutes} min
        </span>
        <RowActions noun="módulo" index={index} total={total} onMove={onMove} onRemove={onRemove} />
      </header>
      <div className="grid gap-5 p-5 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div>
            <Label htmlFor={`${id}-title`}>Título</Label>
            <Input
              id={`${id}-title`}
              value={module.title}
              onChange={(event) => set("title", event.target.value)}
              maxLength={300}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-summary`}>De qué trata</Label>
            <Textarea
              id={`${id}-summary`}
              value={module.summary}
              onChange={(event) => set("summary", event.target.value)}
              className="min-h-[88px]"
              maxLength={2000}
            />
          </div>
        </div>
        <div className="space-y-4">
          <ListEditor
            label="Puntos clave"
            values={module.key_points}
            onChange={(points) => set("key_points", points)}
            placeholder="Una idea que no puede faltar"
            max={8}
          />
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Input
                type="number"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                value={minutesText ?? module.estimated_minutes}
                onChange={(event) => {
                  setMinutesText(event.target.value);
                  const minutes = validMinutes(event.target.value);
                  if (minutes !== null) set("estimated_minutes", minutes);
                }}
                onBlur={() => {
                  if (minutesText === null) return;
                  set("estimated_minutes", clampMinutes(minutesText));
                  setMinutesText(null);
                }}
                className="h-9 w-20"
                aria-label={`Minutos del módulo ${index + 1}`}
              />
              minutos
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={module.include_quiz}
                onCheckedChange={(checked) => set("include_quiz", checked)}
                aria-label={`Evaluación en el módulo ${index + 1}`}
              />
              Con evaluación
            </label>
          </div>
        </div>
      </div>
    </li>
  );
}
