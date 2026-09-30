"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { courseKeys } from "@/lib/api/courses";
import { studioKeys } from "@/lib/api/studio";
import type { Job } from "@/lib/api/types";
import { isActiveJob } from "@/lib/hooks/use-jobs";
import { toastError } from "@/lib/notify";

/** What the studio's requests leave in the cache: the jobs they queued, and a fresh course after a conflict. */
export function useStudioCache() {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      /** Jobs a request just queued: their progress shows (and is polled) now, not on the next poll of the list. */
      trackJobs: (courseId: number, queued: Job[]) => {
        const active = queued.filter(isActiveJob);
        if (!active.length) return;
        const ids = active.map((job) => job.id);
        active.forEach((job) => queryClient.setQueryData(studioKeys.job(job.id), job));
        queryClient.setQueryData<Job[]>(studioKeys.jobs(courseId), (list = []) => [
          ...active,
          ...list.filter((job) => !ids.includes(job.id)),
        ]);
      },

      /**
       * `onError` of the studio's requests: the toast and, after a 409 (the course changed meanwhile, in another
       * tab or by a job), a fresh copy of the course so the step shows why.
       */
      failed: (courseId: number) => (error: unknown) => {
        toastError(error);
        if (error instanceof ApiError && error.status === 409) {
          void queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
        }
      },
    }),
    [queryClient],
  );
}
