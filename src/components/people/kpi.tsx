import { cn } from "@/lib/utils";

interface KpiProps {
  value: string;
  label: string;
  hint?: string;
  /** Its divider: the grid around it knows which figures start a row (those go without one). */
  className?: string;
}

/** A big figure on a dark band, with its label and a hint under it. One of the `<dl>` of a band. */
export function Kpi({ value, label, hint, className }: KpiProps) {
  return (
    <div className={cn("flex flex-col border-white/15", className)}>
      <dt className="order-2 mt-2 text-[10.5px] font-bold uppercase tracking-label text-white/60">{label}</dt>
      <dd className="order-1 font-display text-5xl font-medium tracking-tightest text-white">{value}</dd>
      {hint && <dd className="order-3 mt-1 text-xs text-white/60">{hint}</dd>}
    </div>
  );
}
