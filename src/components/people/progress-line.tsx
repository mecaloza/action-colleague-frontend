import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/format";

/** A progress bar with its percentage at the end. */
export function ProgressLine({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Progress value={value} className="flex-1" aria-label={label} />
      <span className="w-10 text-right text-xs font-semibold">{formatPercent(value)}</span>
    </div>
  );
}
