import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";

/** Decorative stack of the brand mark for dark heroes: two faint outlines over a small orange one. */
export function DiamondMotif({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("pointer-events-none flex flex-col items-center text-white", className)}>
      <LogoMark className="h-[58%] w-auto text-white/15" strokeWidth={1.6} />
      <LogoMark className="-mt-[6%] h-[22%] w-auto text-accent" strokeWidth={4} />
    </span>
  );
}
