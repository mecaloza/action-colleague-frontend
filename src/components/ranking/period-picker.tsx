import type { RankingPeriod } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface PeriodInfo {
  value: RankingPeriod;
  label: string;
  /** How a sentence says it: "Nadie suma puntos hoy". */
  when: string;
}

export const PERIODS: PeriodInfo[] = [
  { value: "today", label: "Hoy", when: "hoy" },
  { value: "week", label: "Semana", when: "esta semana" },
  { value: "month", label: "Mes", when: "este mes" },
  { value: "all", label: "Total", when: "todavía" },
];

export const isPeriod = (value: string | null): value is RankingPeriod => PERIODS.some((period) => period.value === value);

/** "hoy", "esta semana", "este mes" or "todavía" ("Nadie suma puntos todavía"). */
export const periodWhen = (period: RankingPeriod) => PERIODS.find((info) => info.value === period)?.when ?? "";

const DAY = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * "Desde el lunes 5 de octubre": when the period began, as the platform's clock says (its offset is in `starts_at`,
 * so the day is read from the text itself: the browser may be elsewhere).
 */
export function periodStart(period: RankingPeriod, startsAt: string | null): string {
  if (period === "all" || !startsAt) return "Desde siempre";
  if (period === "today") return "Desde la medianoche";
  const [year, month, day] = startsAt.slice(0, 10).split("-").map(Number);
  const date = DAY.format(new Date(Date.UTC(year, month - 1, day)));
  return period === "week" ? `Desde el lunes ${date}` : `Desde el ${date}`;
}

interface PeriodPickerProps {
  value: RankingPeriod;
  onChange: (value: RankingPeriod) => void;
  className?: string;
}

/** Today, this week, this month or since ever: one button each, the one shown pressed. */
export function PeriodPicker({ value, onChange, className }: PeriodPickerProps) {
  return (
    <div role="group" aria-label="Periodo" className={cn("grid grid-cols-4 gap-2 sm:flex sm:flex-wrap", className)}>
      {PERIODS.map((period) => (
        <button
          key={period.value}
          type="button"
          aria-pressed={value === period.value}
          onClick={() => onChange(period.value)}
          className={cn(
            "h-10 border px-3.5 text-[12px] font-semibold transition-colors",
            value === period.value ? "border-ink-800 bg-ink-800 text-white" : "border-input bg-white hover:border-ink-800",
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
