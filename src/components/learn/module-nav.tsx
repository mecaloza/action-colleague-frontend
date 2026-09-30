"use client";

import { CheckCircle2, Circle, Lock } from "lucide-react";
import type { LearnerModule } from "@/lib/api/types";
import { formatDuration, twoDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ModuleNavProps {
  modules: LearnerModule[];
  currentId: number;
  onSelect: (module: LearnerModule) => void;
}

function StateIcon({ module, current }: { module: LearnerModule; current: boolean }) {
  if (module.completed) return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" role="img" aria-label="Completado" />;
  if (!module.unlocked) return <Lock className="h-4 w-4 shrink-0 text-muted-foreground" role="img" aria-label="Bloqueado" />;
  return <Circle className={cn("h-4 w-4 shrink-0", current ? "text-accent" : "text-muted-foreground")} role="img" aria-label="Pendiente" />;
}

/** What a module offers, for the list: its length, or the kind of activity. */
function moduleSubtitle(module: LearnerModule): string {
  if (module.duration_seconds) return formatDuration(module.duration_seconds);
  return module.quiz ? "Con evaluación" : "Lectura";
}

/** The course's modules in order: done, available or still locked. */
export function ModuleNav({ modules, currentId, onSelect }: ModuleNavProps) {
  return (
    <nav aria-label="Módulos del curso">
      <ol className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
        {modules.map((module) => {
          const current = module.id === currentId;
          return (
            <li key={module.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(module)}
                disabled={!module.unlocked}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex w-60 items-start gap-3 border px-4 py-3 text-left transition-colors lg:w-full",
                  current ? "border-ink-800 bg-white" : "border-transparent hover:bg-white",
                  !module.unlocked && "cursor-not-allowed opacity-60 hover:bg-transparent",
                )}
              >
                <span className={cn("font-display text-lg font-medium leading-none", current ? "text-accent-strong" : "text-muted-foreground")}>
                  {twoDigits(module.order)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold">{module.title}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <StateIcon module={module} current={current} />
                    {moduleSubtitle(module)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
