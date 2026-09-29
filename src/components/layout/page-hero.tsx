import { DiamondMotif } from "@/components/brand/motif";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** Black editorial band at the top of a page: eyebrow, big title, description and actions. */
export function PageHero({ eyebrow, title, description, actions, children, className }: PageHeroProps) {
  return (
    <section className={cn("band-dark", className)}>
      <DiamondMotif className="absolute -right-6 -top-10 hidden h-[260px] w-[170px] opacity-90 md:block lg:right-10" />
      <div className="container relative z-10 py-12 md:py-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl animate-slide-up">
            {eyebrow && <p className="eyebrow mb-5 text-white/60">{eyebrow}</p>}
            <h1 className="display-xl text-balance text-white">{title}</h1>
            {description && <div className="mt-5 max-w-2xl text-base text-white/70 md:text-lg">{description}</div>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
        </div>
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}

/** Light page header for inner pages. */
export function PageHeader({ eyebrow, title, description, actions, className }: Omit<PageHeroProps, "children">) {
  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="display-lg text-balance">{title}</h1>
        {description && <div className="mt-3 text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
