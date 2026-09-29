import { useQuery } from "@tanstack/react-query";
import { studioApi, studioKeys } from "@/lib/api/studio";
import type { Job } from "@/lib/api/types";

const POLL_MS = 2000;

export const isActiveJob = (job: Pick<Job, "status">) => job.status === "queued" || job.status === "running";

/** One background job, polled until it succeeds or fails. */
export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: studioKeys.job(jobId ?? ""),
    queryFn: () => studioApi.job(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (query.state.data && !isActiveJob(query.state.data) ? false : POLL_MS),
  });
}

/** The course's queued and running jobs (progress and step of each), polled while there are any. */
export function useActiveJobs(courseId: number, enabled = true) {
  return useQuery({
    queryKey: studioKeys.jobs(courseId),
    queryFn: () => studioApi.activeJobs(courseId),
    enabled,
    refetchInterval: (query) => (query.state.data?.length ? POLL_MS : false),
  });
}
