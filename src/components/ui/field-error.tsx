import { cn } from "@/lib/utils";

/**
 * A field's problem, linked to it with aria-describedby. Always rendered, empty when there is none:
 * as a live region it is read out even when the field already had focus (Enter from that field).
 */
export function FieldError({ id, message }: { id: string; message: string | null }) {
  return (
    <p id={id} aria-live="polite" className={cn("text-xs text-destructive", message && "mt-1.5")}>
      {message}
    </p>
  );
}
