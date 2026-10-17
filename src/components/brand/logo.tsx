import { cn } from "@/lib/utils";

/** Brand mark: an orange diamond with a white "play" triangle. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("h-7 w-7", className)}>
      <path d="M16 1.5 30.5 16 16 30.5 1.5 16Z" fill="#ff4c01" />
      <path d="M13 10.5 21.5 16 13 21.5Z" fill="#fff" />
    </svg>
  );
}

export function Logo({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-display text-[18px] leading-none tracking-[-0.02em]",
          inverse ? "text-white" : "text-ink-800",
        )}
      >
        <span className="font-semibold">Action</span> <span className="font-normal">Colleague</span>
      </span>
    </span>
  );
}
