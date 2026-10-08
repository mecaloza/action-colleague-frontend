import { http } from "./client";
import type { Revision, RevisionApplied, RevisionCreate, RevisionProposal, RevisionSummary, RevisionTarget } from "./types";

/**
 * Changes to a module's script: the AI proposes one from an observation (a job), the admin reviews its diff and
 * applies it (and maybe produces the video again) or discards it. Any applied change can be undone.
 */
export const revisionsApi = {
  /** 202: the proposal is prepared in the background (`job`); the same observation asked twice gets the same one. */
  propose: (moduleId: number, input: RevisionCreate) =>
    http.post<RevisionProposal>(`/modules/${moduleId}/revisions`, input),
  /** The module's changes, newest first: proposals and every change applied to it (and undone). */
  list: (moduleId: number, target?: RevisionTarget) =>
    http.get<RevisionSummary[]>(`/modules/${moduleId}/revisions`, { target }),
  get: (id: number) => http.get<Revision>(`/revisions/${id}`),
  /** Over edits made since in other scenes (409 `revision_stale` when the same ones changed). */
  apply: (id: number, render: boolean) => http.post<RevisionApplied>(`/revisions/${id}/apply`, { render }),
  /** A proposal still being prepared stops. */
  discard: (id: number) => http.post<Revision>(`/revisions/${id}/discard`),
  /** What it changed goes back (edits made since elsewhere stay): the undo is a change of its own, returned. */
  revert: (id: number) => http.post<Revision>(`/revisions/${id}/revert`),
};

export const revisionKeys = {
  /** The changes to the module's script, next to its storyboard and evaluation (keys under the module). */
  list: (moduleId: number) => ["modules", moduleId, "revisions"] as const,
  detail: (id: number) => ["revisions", id] as const,
};
