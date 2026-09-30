/** Spanish formatting helpers for dates, durations, counts and names. */

const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const relativeFormat = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  const date = toDate(value);
  if (!date) return "—";
  return (withTime ? dateTimeFormat : dateFormat).format(date);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "hace 3 días", "hace 5 minutos", "ahora". */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = (date.getTime() - now.getTime()) / 1000;
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return "ahora";
}

/** 5 -> "05": zero-padded numbering for modules and questions, and clock digits. */
export function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const seconds = Math.floor(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = twoDigits(seconds % 60);
  return hours ? `${hours}:${twoDigits(minutes)}:${rest}` : `${minutes}:${rest}`;
}

/** 86.6 -> "87%"; a missing value shows "—". */
export function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

/** 5400 -> "1 h 30 min", 600 -> "10 min". For course lengths. */
export function formatLength(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds < 60) return totalSeconds ? "1 min" : "—";
  const minutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "Ana María Pérez" -> "AM": up to two initials, for avatars. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
