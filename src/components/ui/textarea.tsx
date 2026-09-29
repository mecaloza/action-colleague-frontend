import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "./input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldClasses, "min-h-[96px] resize-y py-3 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
