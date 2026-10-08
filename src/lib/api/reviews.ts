import { ApiError, http } from "./client";
import type { VideoReview, VideoReviewQueued } from "./types";

/**
 * The automatic review of a module's AI video ("Revisión de calidad"): the newest one of its current video, asking for
 * it again, and what the admin does with each finding (a change to the script made for one fixes it: see revisions).
 */
export const reviewsApi = {
  /** 404 while the video has none (or the module has no AI video). */
  get: (moduleId: number) => http.get<VideoReview>(`/modules/${moduleId}/review`),
  /** The review, or null while the video has none (a 404 says just that). */
  find: async (moduleId: number): Promise<VideoReview | null> => {
    try {
      return await reviewsApi.get(moduleId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  /** 202: reviewed again, with new frames of the published video (the same one while it waits or runs). */
  request: (moduleId: number) => http.post<VideoReviewQueued>(`/modules/${moduleId}/review`),
  /** It no longer counts as open (nor keeps the course from being published). */
  dismiss: (reviewId: number, issueId: string) =>
    http.post<VideoReview>(`/reviews/${reviewId}/issues/${encodeURIComponent(issueId)}/dismiss`),
  /** Open again: one dismissed, or fixed by a change that didn't fix it after all. */
  reopen: (reviewId: number, issueId: string) =>
    http.post<VideoReview>(`/reviews/${reviewId}/issues/${encodeURIComponent(issueId)}/reopen`),
};

export const reviewKeys = {
  /** The module's newest review, next to its storyboard and revisions (keys under the module). */
  module: (moduleId: number) => ["modules", moduleId, "review"] as const,
};
