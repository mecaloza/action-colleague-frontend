interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Title, one-line explanation and main action at the top of a course editor tab. */
export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="display-md">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
