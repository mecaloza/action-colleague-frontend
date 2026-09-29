"use client";

import { LanguageField } from "@/components/courses/language-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CourseSettings, Language } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { ChoiceButton } from "./choice-button";

export interface BriefValues {
  brief: string;
  audience: string;
  tone: string;
  minutes: number;
  /** Null lets the AI choose how many modules the course needs. */
  modules: number | null;
  language: Language;
}

const TONES = ["Cercano", "Profesional", "Inspirador", "Técnico y preciso", "Divertido"];
const MINUTES = [10, 20, 30, 45, 60];
const MODULE_COUNTS: (number | null)[] = [null, 2, 3, 4, 5, 6, 8];

export const MIN_BRIEF_CHARS = 30;

/** The form's starting values: what the course already has saved, or the defaults. */
export function initialBrief(language: Language = "es", settings?: Partial<CourseSettings>): BriefValues {
  return {
    brief: settings?.brief ?? "",
    audience: settings?.audience ?? "",
    tone: settings?.tone || TONES[0],
    minutes: settings?.minutes || 20,
    modules: null,
    language,
  };
}

function Chips<T extends string | number | null>({
  label,
  options,
  value,
  format,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  format: (option: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-label text-ink-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ChoiceButton
            key={String(option)}
            selected={option === value}
            onClick={() => onChange(option)}
            className="h-9 px-3.5 text-[12px] font-semibold"
          >
            {format(option)}
          </ChoiceButton>
        ))}
      </div>
    </fieldset>
  );
}

interface BriefFormProps {
  values: BriefValues;
  onChange: (values: BriefValues) => void;
  disabled?: boolean;
}

/** What the AI needs to propose a course: the brief, who it is for, tone, length and language. */
export function BriefForm({ values, onChange, disabled }: BriefFormProps) {
  const set = <K extends keyof BriefValues>(key: K, value: BriefValues[K]) => onChange({ ...values, [key]: value });
  const missing = Math.max(0, MIN_BRIEF_CHARS - values.brief.trim().length);
  return (
    <fieldset disabled={disabled} className="space-y-8">
      <div>
        <Label htmlFor="brief">¿Qué deben aprender?</Label>
        <Textarea
          id="brief"
          value={values.brief}
          onChange={(event) => set("brief", event.target.value)}
          maxLength={8000}
          className="min-h-[160px]"
          placeholder="Ej. Un curso de inducción en seguridad para operarios de planta: uso de EPP, reporte de incidentes y qué hacer ante una emergencia. Deben salir sabiendo actuar, no solo la teoría."
          aria-describedby="brief-hint"
        />
        <p id="brief-hint" className="mt-2 text-xs text-muted-foreground">
          {missing
            ? `Escribe al menos ${plural(missing, "carácter", "caracteres")} más.`
            : "Cuanto más contexto, mejor la propuesta."}{" "}
          Tus documentos (abajo) se usan como fuente.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Label htmlFor="audience">¿Para quién es?</Label>
          <Input
            id="audience"
            value={values.audience}
            onChange={(event) => set("audience", event.target.value)}
            maxLength={500}
            placeholder="Ej. operarios nuevos, sin experiencia previa"
          />
        </div>
        <LanguageField value={values.language} onChange={(language) => set("language", language)} />
      </div>
      <Chips label="Tono" options={TONES} value={values.tone} format={(tone) => tone} onChange={(tone) => set("tone", tone)} />
      <div className="grid gap-8 md:grid-cols-2">
        <Chips
          label="Duración total"
          options={MINUTES}
          value={values.minutes}
          format={(minutes) => `${minutes} min`}
          onChange={(minutes) => set("minutes", minutes)}
        />
        <Chips
          label="Módulos"
          options={MODULE_COUNTS}
          value={values.modules}
          format={(count) => (count === null ? "Que decida la IA" : String(count))}
          onChange={(count) => set("modules", count)}
        />
      </div>
    </fieldset>
  );
}
