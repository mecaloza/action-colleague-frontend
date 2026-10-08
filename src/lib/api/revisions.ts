import { http } from "./client";
import type { Revision, RevisionApplied, RevisionCreate, RevisionProposal, RevisionSummary, RevisionTarget } from "./types";

export interface RevisionListParams {
  target?: RevisionTarget;
  /** Only the changes to this activity. */
  activity_id?: number;
  /** How many, newest first (1..200; 50 when left out). */
  limit?: number;
}

/**
 * Changes to a module's script, its quiz or one of its activities: the AI proposes one from an observation (a job),
 * the admin reviews its diff and applies it (a script's, maybe producing the video again) or discards it. Any applied
 * change can be undone.
 */
export const revisionsApi = {
  /** 202: the proposal is prepared in the background (`job`); the same observation asked twice gets the same one. */
  propose: (moduleId: number, input: RevisionCreate) =>
    http.post<RevisionProposal>(`/modules/${moduleId}/revisions`, input),
  /** The module's changes, newest first: proposals and every change applied to it (and undone). */
  list: (moduleId: number, params: RevisionListParams = {}) =>
    http.get<RevisionSummary[]>(`/modules/${moduleId}/revisions`, { ...params }),
  get: (id: number) => http.get<Revision>(`/revisions/${id}`),
  /** Over edits made since elsewhere (409 `revision_stale` when the same places changed). */
  apply: (id: number, render: boolean) => http.post<RevisionApplied>(`/revisions/${id}/apply`, { render }),
  /** A proposal still being prepared stops. */
  discard: (id: number) => http.post<Revision>(`/revisions/${id}/discard`),
  /** What it changed goes back (edits made since elsewhere stay): the undo is a change of its own, returned. */
  revert: (id: number) => http.post<Revision>(`/revisions/${id}/revert`),
};

export const revisionKeys = {
  /** Every list of the module's changes, next to its storyboard and evaluation (keys under the module). */
  all: (moduleId: number) => ["modules", moduleId, "revisions"] as const,
  /** The changes to the module's script, its quiz or one of its activities. */
  list: (moduleId: number, target: RevisionTarget, activityId: number | null = null) =>
    ["modules", moduleId, "revisions", target, activityId] as const,
  /** The module's changes waiting for the admin's review, to any of them. */
  pending: (moduleId: number) => ["modules", moduleId, "revisions", "pending"] as const,
  detail: (id: number) => ["revisions", id] as const,
};
