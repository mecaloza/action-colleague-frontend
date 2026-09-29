import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Language } from "@/lib/api/types";

interface LanguageFieldProps {
  value: Language;
  onChange: (language: Language) => void;
  className?: string;
}

/** Content-language picker shared by the course creation form and the settings tab. */
export function LanguageField({ value, onChange, className }: LanguageFieldProps) {
  return (
    <div className={className}>
      <Label htmlFor="course-language">Idioma del contenido</Label>
      <Select id="course-language" value={value} onChange={(event) => onChange(event.target.value as Language)}>
        <option value="es">Español</option>
        <option value="en">Inglés</option>
        <option value="pt">Portugués</option>
      </Select>
    </div>
  );
}
