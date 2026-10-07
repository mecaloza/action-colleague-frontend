import { cn } from "@/lib/utils";

/** Strokes of the Rubinstein mark (a diamond with two faceted strips), in a 100×100 box. */
const MARK_STROKES = [
  "M50 0 91 50 50 100 8.8 50Z",
  "M8.8 50 34.1 49.8",
  "M59.8 9.8 34.1 49.8 37.3 83.1",
  "M67.1 50 91 50",
  "M60.8 14.5 67.1 50 38.6 88.4",
];

/** The brand's faceted diamond, drawn in `currentColor` (orange by default). */
export function LogoMark({ className, strokeWidth = 4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="-4 -4 108 108" aria-hidden className={cn("h-8 w-8 text-accent", className)}>
      {MARK_STROKES.map((d) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="miter" />
      ))}
    </svg>
  );
}

/** Rubinstein Colleague: the mark, the RUBINSTEIN wordmark and COLLEAGUE spaced out below, like the
 * consultancy's own "CONSULTING". `inverse` is for dark backgrounds. */
export function Logo({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)} aria-label="Rubinstein Colleague" role="img">
      <LogoMark className={cn("h-9 w-9", inverse ? "text-accent" : "text-ink-900")} />
      <span className="flex flex-col items-start gap-[5px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={inverse ? "/brand/wordmark-white.png" : "/brand/wordmark-ink.png"}
          alt=""
          className="h-[15px] w-auto"
          width={158}
          height={15}
        />
        <span
          className={cn(
            "pl-[2px] text-[8.5px] font-medium uppercase leading-none tracking-[0.62em]",
            inverse ? "text-accent" : "text-ink-700",
          )}
        >
          Colleague
        </span>
      </span>
    </span>
  );
}
