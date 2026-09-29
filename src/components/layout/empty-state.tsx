import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border border-dashed border-input bg-mist/50 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && <div className="mb-5 flex h-12 w-12 items-center justify-center bg-white text-accent [&_svg]:h-6 [&_svg]:w-6">{icon}</div>}
      <h3 className="font-display text-2xl font-medium tracking-tightest">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Inline error block with a retry action. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 border-l-2 border-destructive bg-red-50 px-5 py-4 text-sm">
      <p className="font-semibold text-ink-800">No pudimos cargar esta información.</p>
      <p className="text-muted-foreground">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-[11px] font-bold uppercase tracking-label text-accent hover:underline">
          Reintentar
        </button>
      )}
    </div>
  );
}
