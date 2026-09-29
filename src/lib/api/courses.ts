import { http } from "./client";
import type {
  CourseDetail,
  CourseSettings,
  CourseSource,
  CourseStatus,
  CourseSummary,
  EvaluationAdmin,
  Language,
  LearnerCourseDetail,
  ModuleAdmin,
  ModuleAnalytics,
  ModuleAttempts,
  ModuleSource,
  Participant,
  Question,
} from "./types";

export interface CourseInput {
  title: string;
  description?: string;
  language?: Language;
  source?: CourseSource;
}

export interface CourseUpdate {
  title?: string;
  description?: string;
  language?: Language;
  settings?: Partial<CourseSettings>;
}

export interface ModuleInput {
  title: string;
  description?: string;
  content_text?: string;
  source?: ModuleSource;
}

/** What can change after creation (the source follows the content: upload, recording...). */
export type ModuleUpdate = Partial<Omit<ModuleInput, "source">>;

export interface EvaluationInput {
  questions: Question[];
  max_attempts: number;
  passing_score: number;
}

export interface CourseListParams {
  status?: CourseStatus;
  q?: string;
}

export const coursesApi = {
  list: (params: CourseListParams = {}) => http.get<CourseSummary[]>("/courses", { ...params }),
  get: (id: number) => http.get<CourseDetail>(`/courses/${id}`),
  create: (input: CourseInput) => http.post<CourseDetail>("/courses", input),
  update: (id: number, input: CourseUpdate) => http.patch<CourseDetail>(`/courses/${id}`, input),
  remove: (id: number) => http.delete(`/courses/${id}`),
  publish: (id: number) => http.post<CourseDetail>(`/courses/${id}/publish`),
  unpublish: (id: number) => http.post<CourseDetail>(`/courses/${id}/unpublish`),
  archive: (id: number) => http.post<CourseDetail>(`/courses/${id}/archive`),
  preview: (id: number) => http.get<LearnerCourseDetail>(`/courses/${id}/preview`),

  createModule: (courseId: number, input: ModuleInput) => http.post<ModuleAdmin>(`/courses/${courseId}/modules`, input),
  updateModule: (id: number, input: ModuleUpdate) => http.patch<ModuleAdmin>(`/modules/${id}`, input),
  removeModule: (id: number) => http.delete(`/modules/${id}`),
  reorderModules: (courseId: number, moduleIds: number[]) =>
    http.put<ModuleAdmin[]>(`/courses/${courseId}/modules/order`, { module_ids: moduleIds }),

  getEvaluation: (moduleId: number) => http.get<EvaluationAdmin>(`/modules/${moduleId}/evaluation`),
  saveEvaluation: (moduleId: number, input: EvaluationInput) =>
    http.put<EvaluationAdmin>(`/modules/${moduleId}/evaluation`, input),
  removeEvaluation: (moduleId: number) => http.delete(`/modules/${moduleId}/evaluation`),

  participants: (courseId: number) => http.get<Participant[]>(`/courses/${courseId}/participants`),
  addParticipants: (courseId: number, userIds: number[]) =>
    http.post<Participant[]>(`/courses/${courseId}/participants`, { user_ids: userIds }),
  removeParticipant: (courseId: number, userId: number) => http.delete(`/courses/${courseId}/participants/${userId}`),
  participantAttempts: (courseId: number, userId: number) =>
    http.get<ModuleAttempts[]>(`/courses/${courseId}/participants/${userId}/attempts`),
  analytics: (courseId: number) =>
    http.get<{ course_id: number; modules: ModuleAnalytics[] }>(`/courses/${courseId}/analytics`),
};

export const courseKeys = {
  all: ["courses"] as const,
  list: (params: CourseListParams) => ["courses", "list", params] as const,
  detail: (id: number) => ["courses", id] as const,
  evaluation: (moduleId: number) => ["modules", moduleId, "evaluation"] as const,
  participants: (id: number) => ["courses", id, "participants"] as const,
  attempts: (id: number, userId: number) => ["courses", id, "participants", userId] as const,
  analytics: (id: number) => ["courses", id, "analytics"] as const,
  preview: (id: number) => ["courses", id, "preview"] as const,
};
