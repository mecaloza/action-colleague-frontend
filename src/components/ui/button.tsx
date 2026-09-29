import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-sans font-bold uppercase tracking-[0.08em] transition-[background-color,color,border-color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink-800 text-white hover:bg-ink-950",
        accent: "bg-accent text-white hover:bg-accent-hover",
        outline: "border border-ink-800 bg-transparent text-ink-800 hover:bg-ink-800 hover:text-white",
        secondary: "bg-mist text-ink-800 hover:bg-fog",
        ghost: "text-ink-800 hover:bg-mist",
        inverse: "bg-white text-ink-900 hover:bg-mist",
        "outline-inverse": "border border-white/40 bg-ink-950/70 text-white hover:border-white hover:bg-white hover:text-ink-900",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        link: "h-auto p-0 normal-case tracking-normal text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 text-[12px]",
        sm: "h-9 px-4 text-[11px]",
        lg: "h-12 px-8 text-[13px]",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Component>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
