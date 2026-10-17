import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClasses =
  "w-full rounded-sm border border-input bg-white px-3.5 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground/70 hover:border-ink-500 focus-visible:border-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-mist disabled:opacity-70 aria-[invalid=true]:border-destructive";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        fieldClasses,
        "h-11 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
