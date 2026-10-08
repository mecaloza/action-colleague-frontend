import { useEffect, useMemo, useRef, type RefObject } from "react";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/** The zones of the region (and a few more), by the city people know them by. */
const COMMON_ZONES: { value: string; city: string }[] = [
  { value: "America/Mexico_City", city: "Ciudad de México" },
  { value: "America/Monterrey", city: "Monterrey" },
  { value: "America/Cancun", city: "Cancún" },
  { value: "America/Tijuana", city: "Tijuana" },
  { value: "America/Guatemala", city: "Guatemala" },
  { value: "America/El_Salvador", city: "San Salvador" },
  { value: "America/Tegucigalpa", city: "Tegucigalpa" },
  { value: "America/Managua", city: "Managua" },
  { value: "America/Costa_Rica", city: "San José de Costa Rica" },
  { value: "America/Panama", city: "Panamá" },
  { value: "America/Havana", city: "La Habana" },
  { value: "America/Santo_Domingo", city: "Santo Domingo" },
  { value: "America/Puerto_Rico", city: "San Juan de Puerto Rico" },
  { value: "America/Bogota", city: "Bogotá" },
  { value: "America/Caracas", city: "Caracas" },
  { value: "America/Guayaquil", city: "Quito y Guayaquil" },
  { value: "America/Lima", city: "Lima" },
  { value: "America/La_Paz", city: "La Paz" },
  { value: "America/Santiago", city: "Santiago de Chile" },
  { value: "America/Asuncion", city: "Asunción" },
  { value: "America/Argentina/Buenos_Aires", city: "Buenos Aires" },
  { value: "America/Montevideo", city: "Montevideo" },
  { value: "America/Sao_Paulo", city: "São Paulo" },
  { value: "Europe/Madrid", city: "Madrid" },
  { value: "UTC", city: "UTC (tiempo universal)" },
];

const OTHER = "other";

export const isCommonZone = (zone: string) => COMMON_ZONES.some((item) => item.value === zone);

/**
 * The zone typed as the server spells it ("america/bogota" -> "America/Bogota"), or null when there is no such zone.
 * The browser knows the same IANA zones; the server checks the exact name again.
 */
export function knownZone(raw: string): string | null {
  const name = raw.trim();
  if (!name) return null;
  try {
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: name }).resolvedOptions().timeZone;
    // Same name in other capitals: the canonical one. Another name (an alias) stays as typed.
    return resolved.toLowerCase() === name.toLowerCase() ? resolved : name;
  } catch {
    return null;
  }
}

/** "GMT-5" right now (daylight saving included), or "" if the browser can't tell. */
function offsetOf(zone: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("es", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(now);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

interface TimezoneFieldProps {
  value: string;
  /** Typing a zone not in the list ("Otra zona"). */
  custom: boolean;
  error: string | null;
  onChange: (value: string, custom: boolean) => void;
  selectRef: RefObject<HTMLSelectElement>;
  inputRef: RefObject<HTMLInputElement>;
}

const ERROR_ID = "settings-timezone-error";
const HINT_ID = "settings-timezone-hint";

/** The platform's time zone: a city of the list, or any other zone written by its IANA name (the only one that can be
 * wrong: `error` is its). */
export function TimezoneField({ value, custom, error, onChange, selectRef, inputRef }: TimezoneFieldProps) {
  const zones = useMemo(() => {
    const now = new Date();
    return COMMON_ZONES.map((zone) => {
      const offset = offsetOf(zone.value, now);
      return { ...zone, label: offset ? `${zone.city} (${offset})` : zone.city };
    });
  }, []);
  // Choosing "Otra zona" goes on to the field where it is written.
  const writeNext = useRef(false);
  useEffect(() => {
    if (custom && writeNext.current) inputRef.current?.focus();
    writeNext.current = false;
  }, [custom, inputRef]);
  return (
    <div>
      <Label htmlFor="settings-timezone">Zona horaria</Label>
      <Select
        ref={selectRef}
        id="settings-timezone"
        value={custom ? OTHER : value}
        onChange={(event) => {
          const chosen = event.target.value;
          // "Otra zona" starts from the one chosen, to edit it.
          if (chosen === OTHER) {
            writeNext.current = true;
            onChange(value, true);
          } else {
            onChange(chosen, false);
          }
        }}
        aria-describedby={HINT_ID}
      >
        {zones.map((zone) => (
          <option key={zone.value} value={zone.value}>
            {zone.label}
          </option>
        ))}
        <option value={OTHER}>Otra zona (escribirla)</option>
      </Select>
      {custom && (
        <div className="mt-3">
          <Label htmlFor="settings-timezone-other">Nombre de la zona</Label>
          <Input
            ref={inputRef}
            id="settings-timezone-other"
            value={value}
            onChange={(event) => onChange(event.target.value, true)}
            placeholder="Ej. America/Bogota"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={64}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ERROR_ID} ${HINT_ID}` : HINT_ID}
          />
        </div>
      )}
      <FieldError id={ERROR_ID} message={error} />
      <p id={HINT_ID} className="mt-1.5 text-xs text-muted-foreground">
        Con ella se escriben las fechas de los certificados.
        {custom && " Escríbela con su nombre IANA, por ejemplo «America/Bogota»."}
      </p>
    </div>
  );
}
