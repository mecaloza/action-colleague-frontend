"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeAt, replaceAt } from "@/lib/array";

interface ListEditorProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  max: number;
  maxLength?: number;
}

/** A short list of one-line texts (objectives, key points, bullets). */
export function ListEditor({ label, values, onChange, placeholder, max, maxLength = 300 }: ListEditorProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-label text-ink-700">{label}</legend>
      <ul className="space-y-2">
        {values.map((value, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" aria-hidden />
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
              onClick={() => onChange(removeAt(values, index))}
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
