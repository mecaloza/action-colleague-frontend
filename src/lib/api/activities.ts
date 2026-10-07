import { http } from "./client";
import type { ActivityAdmin, ActivityMoveResult, ActivityPlay, ActivityType, Job } from "./types";

export interface ActivityInput {
  type: ActivityType;
  title: string;
  intro?: string;
  spec: Record<string, unknown>;
  status?: "draft" | "ready";
}

export type ActivityChanges = Partial<Pick<ActivityAdmin, "title" | "intro" | "spec" | "status">>;

/** Admin side of the interactive activities: write, order, publish, try them. */
export const activitiesApi = {
  list: (moduleId: number) => http.get<ActivityAdmin[]>(`/modules/${moduleId}/activities`),
  create: (moduleId: number, input: ActivityInput) =>
    http.post<ActivityAdmin>(`/modules/${moduleId}/activities`, input),
  update: (activityId: number, changes: ActivityChanges) =>
    http.put<ActivityAdmin>(`/activities/${activityId}`, changes),
  remove: (activityId: number) => http.delete(`/activities/${activityId}`),
  order: (moduleId: number, ids: number[]) =>
    http.put<ActivityAdmin[]>(`/modules/${moduleId}/activities/order`, { ids }),
  setImage: (activityId: number, assetId: string | null) =>
    http.put<ActivityAdmin>(`/activities/${activityId}/image`, { asset_id: assetId }),
  generate: (moduleId: number) => http.post<Job>(`/modules/${moduleId}/activities/generate`),
  voice: (activityId: number) => http.post<Job>(`/activities/${activityId}/narration`),
  preview: (activityId: number) => http.post<ActivityPlay>(`/activities/${activityId}/preview`),
  previewMove: (attemptId: number, move: Record<string, unknown>) =>
    http.post<ActivityMoveResult>(`/activity-previews/${attemptId}/moves`, { move }),
};

export const activityKeys = {
  module: (moduleId: number) => ["modules", moduleId, "activities"] as const,
};
