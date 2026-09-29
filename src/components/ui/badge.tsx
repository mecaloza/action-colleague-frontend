import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em]",
  {
    variants: {
      variant: {
        default: "bg-ink-800 text-white",
        secondary: "bg-mist text-ink-700",
        outline: "border border-border text-ink-700",
        accent: "bg-accent-soft text-accent-strong",
        success: "bg-green-50 text-success",
        warning: "bg-amber-50 text-warning",
        destructive: "bg-red-50 text-destructive",
        inverse: "bg-black/60 text-white",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Adds a small pulsing dot, for "in progress" states. */
  pulse?: boolean;
}

function Badge({ className, variant, pulse, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full motion-safe:animate-ping bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
