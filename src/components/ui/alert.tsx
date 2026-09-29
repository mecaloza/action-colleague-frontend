import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex w-full gap-3 rounded-sm border-l-2 px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-ink-800 bg-mist text-ink-800",
        info: "border-accent bg-accent-soft text-ink-800 [&>svg]:text-accent",
        success: "border-success bg-green-50 text-ink-800 [&>svg]:text-success",
        warning: "border-warning bg-amber-50 text-ink-800 [&>svg]:text-warning",
        destructive: "border-destructive bg-red-50 text-ink-800 [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  ),
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h5 ref={ref} className={cn("font-bold leading-tight", className)} {...props} />,
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-sm leading-relaxed", className)} {...props} />,
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
