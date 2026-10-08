"use client";

import { useEffect, useRef } from "react";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { courseKeys } from "@/lib/api/courses";
import { reviewKeys, reviewsApi } from "@/lib/api/reviews";
import { studioKeys } from "@/lib/api/studio";
import type { ModuleAdmin } from "@/lib/api/types";
import { toastError } from "@/lib/notify";
import { isReviewing, reviewEnded } from "./qa";
import { useStudioCache } from "./use-studio-cache";

/** A review being made is followed this often. */
const REVIEWING_POLL_MS = 2000;

/** The video's file, whatever its signature: a new one is a new video (with its own review). */
const videoFile = (module: ModuleAdmin) => module.video?.url.split("?")[0] ?? null;

/** The course itself, not what hangs from it: its modules carry the badge of their review. */
const refreshBadges = (queryClient: QueryClient, courseId: number) =>
  queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId), exact: true });

/**
 * The newest review of the module's video (null while it has none), followed while it is being made. The course's
 * own polls tell when it changed elsewhere (reviewed again, a new video, findings fixed by a change): it is loaded
 * again then; and when one followed here ends, the course is (its modules say how their review went).
 */
export function useVideoReview(module: ModuleAdmin, courseId: number) {
  const queryClient = useQueryClient();
  const review = useQuery({
    queryKey: reviewKeys.module(module.id),
    queryFn: () => reviewsApi.find(module.id),
    refetchOnMount: "always", // a copy kept from before may be out of date
    refetchInterval: (query) => (isReviewing(query.state.data) ? REVIEWING_POLL_MS : false),
  });

  const seen = JSON.stringify([module.review, videoFile(module)]);
  const lastSeen = useRef(seen);
  useEffect(() => {
    if (lastSeen.current === seen) return;
    lastSeen.current = seen;
    void queryClient.invalidateQueries({ queryKey: reviewKeys.module(module.id) });
  }, [seen, module.id, queryClient]);

  const status = review.data?.status;
  const lastStatus = useRef(status);
  useEffect(() => {
    const was = lastStatus.current;
    lastStatus.current = status;
    if (reviewEnded(was, status)) void refreshBadges(queryClient, courseId);
  }, [status, courseId, queryClient]);

  return review;
}

/** Has the module's video reviewed (again): new frames, taken from the published video. */
export function useRequestReview(courseId: number, moduleId: number) {
  const queryClient = useQueryClient();
  const { trackJobs, failed } = useStudioCache();
  return useMutation({
    mutationFn: () => reviewsApi.request(moduleId),
    onSuccess: ({ review, job }) => {
      queryClient.setQueryData(reviewKeys.module(moduleId), review);
      queryClient.setQueryData(studioKeys.job(job.id), job);
      trackJobs(courseId, [job]);
      // The module says its video is being reviewed (and the course is followed meanwhile).
      void refreshBadges(queryClient, courseId);
    },
    onError: failed(courseId),
  });
}

export type IssueAction = "dismiss" | "reopen";

/** Dismisses a finding of the review, or opens it again (one dismissed, or fixed by a change that didn't fix it). */
export function useIssueAction(courseId: number, moduleId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, issueId, action }: { reviewId: number; issueId: string; action: IssueAction }) =>
      action === "dismiss" ? reviewsApi.dismiss(reviewId, issueId) : reviewsApi.reopen(reviewId, issueId),
    onSuccess: (review, { action }) => {
      queryClient.setQueryData(reviewKeys.module(moduleId), review);
      // Its module counts what is still open (and a course may now be published).
      void refreshBadges(queryClient, courseId);
      toast.success(action === "dismiss" ? "Hallazgo ignorado" : "Hallazgo abierto de nuevo");
    },
    onError: (error) => {
      toastError(error);
      void queryClient.invalidateQueries({ queryKey: reviewKeys.module(moduleId) });
    },
  });
}
