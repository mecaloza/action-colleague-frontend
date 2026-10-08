"use client";

import type { ComponentProps } from "react";
import { ActivityPlayer } from "@/components/learn/activities/activity-player";
import { activitiesApi } from "@/lib/api/activities";
import type { Language } from "@/lib/api/types";

interface ActivityPreviewProps {
  activity: ComponentProps<typeof ActivityPlayer>["activity"];
  language: Language;
  onClose: () => void;
}

/** An activity played as the admin's preview (nothing is saved); the caller's `key` starts it anew. */
export function ActivityPreview({ activity, language, onClose }: ActivityPreviewProps) {
  return (
    <ActivityPlayer
      activity={activity}
      open
      onOpenChange={(open) => !open && onClose()}
      allowUntimed={false}
      language={language}
      api={{ start: () => activitiesApi.preview(activity.id), move: activitiesApi.previewMove }}
    />
  );
}
