"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";
import { removeAt, replaceAt } from "@/lib/array";

// Only the script editor shows icons: the other lists don't load the catalog.
const IconPicker = dynamic(() => import("./icon-picker").then((module) => module.IconPicker));

interface ListEditorProps {
  label: string;
  values: string[];
  /** With icons, `icons` comes along whenever a value is removed (both change in one update). */
  onChange: (values: string[], icons?: string[]) => void;
  placeholder: string;
  max: number;
  maxLength?: number;
  /** One icon per value: a picker shows before each one (removing a value removes its icon too). */
  icons?: string[];
  onIconsChange?: (icons: string[]) => void;
}

/** A short list of one-line texts (objectives, key points, bullets). */
export function ListEditor({
  label,
  values,
  onChange,
  placeholder,
  max,
  maxLength = 300,
  icons,
  onIconsChange,
}: ListEditorProps) {
  // Padded to the values, so every value has its icon (or "") and they stay in step.
  const iconOf = (index: number) => (icons && index < icons.length ? icons[index] : "");
  const allIcons = () => values.map((_, index) => iconOf(index));
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-label text-ink-700">{label}</legend>
      <ul className="space-y-2">
        {values.map((value, index) => (
          <li key={index} className="flex items-center gap-2">
            {onIconsChange ? (
              <IconPicker
                value={iconOf(index)}
                onChange={(icon) => onIconsChange(replaceAt(allIcons(), index, icon))}
                label={`${label} ${index + 1}`}
              />
            ) : (
              <span className="h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" aria-hidden />
            )}
            <Input
              value={value}
              onChange={(event) => onChange(replaceAt(values, index, event.target.value))}
              placeholder={placeholder}
              maxLength={maxLength}
              aria-label={`${label} ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Quitar: ${value || `${label} ${index + 1}`}`}
              onClick={() => onChange(removeAt(values, index), onIconsChange && removeAt(allIcons(), index))}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      {values.length < max && (
        <Button type="button" variant="link" className="mt-2 text-[13px]" onClick={() => onChange([...values, ""])}>
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      )}
    </fieldset>
  );
}
