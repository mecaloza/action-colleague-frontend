import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = { accent: "bg-accent", ink: "bg-ink-800", success: "bg-success" };

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value?: number | null;
  /** Animated bar for work of unknown length (ignores `value`). */
  indeterminate?: boolean;
  tone?: keyof typeof TONES;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, indeterminate = false, tone = "accent", ...props }, ref) => {
    const percent = indeterminate ? null : Math.min(100, Math.max(0, value ?? 0));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? undefined : Math.round(percent)}
        className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-fog", className)}
        {...props}
      >
        {percent === null ? (
          <div className={cn("absolute inset-y-0 w-1/3 rounded-full animate-progress-indeterminate", TONES[tone])} />
        ) : (
          <div
            className={cn("h-full rounded-full transition-[width] duration-500 ease-out", TONES[tone])}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
