"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { activityKeys } from "@/lib/api/activities";
import { courseKeys } from "@/lib/api/courses";
import { revisionKeys, revisionsApi } from "@/lib/api/revisions";
import { studioKeys } from "@/lib/api/studio";
import type { RevisionTarget } from "@/lib/api/types";
import { toastError } from "@/lib/notify";

/** What a change is to: the module's script, its quiz or one of its activities. */
export interface RevisionRef {
  target: RevisionTarget;
  moduleId: number;
  /** An activity's change: which activity. */
  activityId?: number | null;
}

// What has edits not saved in an open editor, in this tab: a module's script or quiz, an activity. Undoing a change to
// it would replace them (the editor takes the server's new copy): the panel holds its buttons back, and a toast's
// «Deshacer», which outlives the panel, asks here as it is tapped.
const unsavedEdits = new Set<string>();

const editsKey = ({ target, moduleId, activityId }: RevisionRef) =>
  target === "activity" ? `activity:${activityId}` : `${target}:${moduleId}`;

/** The editor of a module's script or quiz, or of an activity, says whether it has edits not saved. */
export function useUnsavedEdits(ref: RevisionRef, dirty: boolean) {
  const key = editsKey(ref);
  useEffect(() => {
    if (!dirty) return;
    unsavedEdits.add(key);
    return () => {
      unsavedEdits.delete(key);
    };
  }, [key, dirty]);
}

/** What the change is about has edits not saved in its editor right now. */
export const hasUnsavedEdits = (ref: RevisionRef) => unsavedEdits.has(editsKey(ref));

/** What a change leaves to refresh, and undoing one (also from a toast, once its panel closed). */
export function useRevisionCache() {
  const queryClient = useQueryClient();

  return useMemo(() => {
    /**
     * A proposal was asked for or ended: the module's changes and the course (whose module says a change waits) are
     * fetched again.
     */
    const refreshChanges = (courseId: number, moduleId: number) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: revisionKeys.all(moduleId) }),
        queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId), exact: true }),
      ]);

    /**
     * The module's script changed (applied, undone): its script too (an open editor shows the new one) and, as after
     * a save, the previews that show a picture (a new version of an infographic may be on its way).
     */
    const refreshScript = (courseId: number, moduleId: number) => {
      void queryClient.invalidateQueries({
        queryKey: ["slides", "preview"],
        predicate: (query) => String(query.queryKey[2]).includes('"visual":'),
      });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: studioKeys.storyboard(moduleId) }),
        refreshChanges(courseId, moduleId),
      ]);
    };

    /**
     * The module's quiz changed: the quiz (an open editor shows the new one), its changes, and the course with what
     * hangs from it (its modules' question counts, the results by question).
     */
    const refreshQuiz = (courseId: number, moduleId: number) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKeys.evaluation(moduleId) }),
        queryClient.invalidateQueries({ queryKey: revisionKeys.all(moduleId) }),
        queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) }),
      ]);

    /** One of the module's activities changed: the module's list (its new version, its voice) and the preview. */
    const refreshActivity = (courseId: number, moduleId: number) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: activityKeys.module(moduleId) }),
        queryClient.invalidateQueries({ queryKey: courseKeys.preview(courseId) }),
        refreshChanges(courseId, moduleId),
      ]);

    /** A change was applied or undone: what it changed (the script, the quiz or the activity) and its history. */
    const refreshContent = (courseId: number, { target, moduleId }: RevisionRef) => {
      if (target === "quiz") return refreshQuiz(courseId, moduleId);
      if (target === "activity") return refreshActivity(courseId, moduleId);
      return refreshScript(courseId, moduleId);
    };

    /** Undoes an applied change: what it changed goes back, edits made since elsewhere stay. True when undone. */
    const undo = async (courseId: number, ref: RevisionRef, revisionId: number): Promise<boolean> => {
      try {
        const undone = await revisionsApi.revert(revisionId);
        queryClient.setQueryData(revisionKeys.detail(undone.id), undone);
        toast.success("Cambio deshecho");
        return true;
      } catch (error) {
        toastError(error); // e.g. the same places changed since: the message says where
        return false;
      } finally {
        void queryClient.invalidateQueries({ queryKey: revisionKeys.detail(revisionId) });
        void refreshContent(courseId, ref);
      }
    };

    return { refreshChanges, refreshContent, undo };
  }, [queryClient]);
}
