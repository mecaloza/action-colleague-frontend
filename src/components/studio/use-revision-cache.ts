"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { courseKeys } from "@/lib/api/courses";
import { revisionKeys, revisionsApi } from "@/lib/api/revisions";
import { studioKeys } from "@/lib/api/studio";
import { toastError } from "@/lib/notify";

// The modules whose script has edits not saved in an open editor, in this tab. Undoing a change to one would replace
// them (the editor takes the server's new copy): the panel holds its buttons back, and a toast's «Deshacer», which
// outlives the panel, asks here as it is tapped.
const unsavedScripts = new Set<number>();

/** The script editor of `moduleId` says whether it has edits not saved. */
export function useUnsavedScript(moduleId: number, dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    unsavedScripts.add(moduleId);
    return () => {
      unsavedScripts.delete(moduleId);
    };
  }, [moduleId, dirty]);
}

/** The module's script has edits not saved in the editor right now. */
export const hasUnsavedScript = (moduleId: number) => unsavedScripts.has(moduleId);

/** What a change to a module's script leaves to refresh, and undoing one (also from a toast, once its panel closed). */
export function useRevisionCache() {
  const queryClient = useQueryClient();

  return useMemo(() => {
    /**
     * A proposal was asked for or ended: the module's changes and the course (whose module says a change waits) are
     * fetched again.
     */
    const refreshChanges = (courseId: number, moduleId: number) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: revisionKeys.list(moduleId) }),
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

    /** Undoes an applied change: what it changed goes back, edits made since elsewhere stay. True when undone. */
    const undo = async (courseId: number, moduleId: number, revisionId: number): Promise<boolean> => {
      try {
        const undone = await revisionsApi.revert(revisionId);
        queryClient.setQueryData(revisionKeys.detail(undone.id), undone);
        toast.success("Cambio deshecho");
        return true;
      } catch (error) {
        toastError(error); // e.g. the same scenes changed since: the message says where
        return false;
      } finally {
        void queryClient.invalidateQueries({ queryKey: revisionKeys.detail(revisionId) });
        void refreshScript(courseId, moduleId);
      }
    };

    return { refreshChanges, refreshScript, undo };
  }, [queryClient]);
}
