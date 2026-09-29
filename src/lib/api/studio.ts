import { apiRequest, http } from "./client";
import type {
  Avatar,
  CourseDetail,
  CourseOutline,
  Job,
  OutlineRequest,
  Question,
  RenderRequest,
  Slide,
  SlideContext,
  Storyboard,
  StudioCapabilities,
  Voice,
} from "./types";

/** Result of an `ai.quiz` job: questions to review in the editor before saving them. */
export interface QuizSuggestion {
  questions: Question[];
}

/** The API lists jobs without filtering by type: the newest ones of a course are searched (200 is its maximum). */
const RECENT_JOBS = 200;

/** How long the studio trusts what it loaded: coming back to the tab refetches it (another tab may have changed it). */
export const STUDIO_STALE_MS = 5_000;

export const studioApi = {
  capabilities: () => http.get<StudioCapabilities>("/studio/capabilities"),

  generateOutline: (courseId: number, input: OutlineRequest) =>
    http.post<Job>(`/courses/${courseId}/outline/generate`, input),
  outline: (courseId: number) => http.get<CourseOutline>(`/courses/${courseId}/outline`),
  applyOutline: (courseId: number, outline: CourseOutline) =>
    http.put<CourseDetail>(`/courses/${courseId}/outline`, outline),

  /** Storyboard, reading and quiz of the AI modules still without a script (or of `moduleIds`). */
  draft: (courseId: number, moduleIds?: number[]) =>
    http.post<Job[]>(`/courses/${courseId}/draft`, { module_ids: moduleIds ?? null }),
  storyboard: (moduleId: number) => http.get<Storyboard>(`/modules/${moduleId}/storyboard`),
  saveStoryboard: (moduleId: number, storyboard: Storyboard) =>
    http.put<Storyboard>(`/modules/${moduleId}/storyboard`, storyboard),
  regenerateStoryboard: (moduleId: number, feedback: string) =>
    http.post<Job>(`/modules/${moduleId}/storyboard/regenerate`, { feedback }),
  suggestQuiz: (moduleId: number, count = 5) => http.post<Job>(`/modules/${moduleId}/evaluation/generate`, { count }),

  /** The PNG the video will use for this slide (same renderer as the video). */
  slidePreview: (slide: Slide, context: SlideContext, signal?: AbortSignal) =>
    apiRequest<Blob>("/slides/preview", { method: "POST", body: { slide, context }, as: "blob", signal }),

  voices: () => http.get<Voice[]>("/studio/voices"),
  cloneVoice: (name: string, sample: File) => {
    const form = new FormData();
    form.append("name", name);
    form.append("file", sample);
    return apiRequest<Voice>("/studio/voices/clone", { method: "POST", body: form });
  },
  avatars: () => http.get<Avatar[]>("/studio/avatars"),

  render: (courseId: number, input: RenderRequest) => http.post<Job[]>(`/courses/${courseId}/render`, input),
  renderModule: (moduleId: number) => http.post<Job>(`/modules/${moduleId}/render`),

  job: (jobId: string) => http.get<Job>(`/jobs/${jobId}`),
  activeJobs: (courseId: number) => http.get<Job[]>("/jobs", { course_id: courseId, active: true }),
  /** The course's newest job of `type` (queued, running or finished), or null. */
  latestJob: async (courseId: number, type: string) => {
    const jobs = await http.get<Job[]>("/jobs", { course_id: courseId, limit: RECENT_JOBS });
    return jobs.find((job) => job.type === type) ?? null;
  },
};

export const studioKeys = {
  capabilities: ["studio", "capabilities"] as const,
  voices: ["studio", "voices"] as const,
  avatars: ["studio", "avatars"] as const,
  // Under the course's key: refreshing the course (`useCourseCache`) refreshes these too.
  outline: (courseId: number) => ["courses", courseId, "outline"] as const,
  jobs: (courseId: number) => ["courses", courseId, "jobs"] as const,
  latestJob: (courseId: number, type: string) => ["courses", courseId, "latest-job", type] as const,
  materials: (courseId: number) => ["courses", courseId, "materials"] as const,
  job: (jobId: string) => ["jobs", jobId] as const,
  storyboard: (moduleId: number) => ["modules", moduleId, "storyboard"] as const,
};
