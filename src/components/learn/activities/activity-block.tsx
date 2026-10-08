"use client";

import {
  CheckCircle2,
  Gamepad2,
  MessagesSquare,
  Play,
  RotateCcw,
  ScanSearch,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActivityType, LearnerActivitySummary } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { ACTIVITY_LABELS } from "./activity-player";

const ICONS: Record<ActivityType, typeof Play> = {
  decision: MessagesSquare,
  inspection: ScanSearch,
  simulator: SlidersHorizontal,
  quick: Timer,
};

/** A play left open is picked up where it was; otherwise a new one starts. An admin's preview only tries it. */
const playLabel = (activity: LearnerActivitySummary, preview: boolean) =>
  preview ? "Probar" : activity.resumable ? "Continuar" : activity.finished ? "Jugar de nuevo" : "Jugar";

interface ActivityBlockProps {
  activities: LearnerActivitySummary[];
  onPlay: (activity: LearnerActivitySummary) => void;
  /** The admin's preview of the course: each activity is tried, nothing is pending or scored. */
  preview?: boolean;
}

/** The module's activities, after its video: what each is, its best score, and a button to play. */
export function ActivityBlock({ activities, onPlay, preview = false }: ActivityBlockProps) {
  if (!activities.length) return null;
  const pending = activities.filter((activity) => !activity.finished).length;
  return (
    <section aria-labelledby="activities-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow mb-2 flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-accent" /> Practica lo aprendido
          </p>
          <h3 id="activities-title" className="display-md">
            Actividades
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {preview
            ? `${activities.length === 1 ? "Pruébala como la" : "Pruébalas como las"} jugará tu equipo: nada se guarda.`
            : pending
              ? `Te ${pending === 1 ? "falta" : "faltan"} ${plural(pending, "actividad", "actividades")}`
              : "Las completaste todas"}
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {activities.map((activity) => {
          const Icon = ICONS[activity.type];
          const replay = !preview && activity.finished && !activity.resumable;
          const label = playLabel(activity, preview);
          return (
            <li key={activity.id} className="flex flex-col gap-4 border border-border bg-white p-5">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink-900 text-accent"
                  aria-hidden
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-label text-muted-foreground">
                    {ACTIVITY_LABELS[activity.type]}
                  </p>
                  <p className="font-semibold">{activity.title}</p>
                  {activity.intro && <p className="mt-1 text-sm text-muted-foreground">{activity.intro}</p>}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3">
                {preview ? (
                  <p className="text-sm text-muted-foreground">Hasta {plural(activity.max_score, "punto")}</p>
                ) : activity.finished ? (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" /> {activity.best_score} de {activity.max_score} puntos
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {activity.resumable ? "Partida sin terminar" : "Pendiente"} · hasta {plural(activity.max_score, "punto")}
                  </p>
                )}
                <Button
                  variant={replay ? "outline" : "accent"}
                  className="shrink-0"
                  onClick={() => onPlay(activity)}
                  aria-label={`${label}: ${activity.title}`}
                >
                  {replay ? <RotateCcw /> : <Play />} {label}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
