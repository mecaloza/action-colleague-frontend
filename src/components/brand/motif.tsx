import { cn } from "@/lib/utils";

/** Decorative stack of diamonds (the brand mark's shape) for dark heroes. */
export function DiamondMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 300" aria-hidden className={cn("pointer-events-none text-white", className)}>
      <rect x="45" y="30" width="110" height="110" transform="rotate(45 100 85)" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="1.5" />
      <rect x="62" y="128" width="76" height="76" transform="rotate(45 100 166)" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
      <rect x="78" y="212" width="44" height="44" transform="rotate(45 100 234)" fill="#ff4c01" />
    </svg>
  );
}
