/**
 * Legacy endpoints used by screens that have not been rebuilt yet. Authentication and
 * token refresh go through the shared client in `@/lib/api/client`.
 */
import {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  Evaluation,
  CreateEvaluationRequest,
  UpdateEvaluationRequest,
  EvaluationAnalytics,
  EmployeeResponse,
  UserResponseDetail,
} from "@/lib/types";
import { API_BASE, refreshAccessToken, tokenStore } from "@/lib/api/client";

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = tokenStore.access();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token && !options?.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let res = await fetch(url, { ...options, headers });

  // On 401, refresh once (shared with the new client) and retry. If the refresh token is
  // rejected, the client signs the user out and the app shell redirects to /login.
  if (res.status === 401 && !options?.skipAuth) {
    headers["Authorization"] = `Bearer ${await refreshAccessToken(token)}`;
    res = await fetch(url, { ...options, headers });
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`API Error: ${res.status} ${res.statusText} ${errorBody}`);
  }
  return res.json();
}

export const api = {
  // Users (admin)
  getUsers: async (): Promise<User[]> => {
    const raw = await fetchAPI<any[]>("/users/");
    // Guard: Ensure raw is array before mapping
    if (!Array.isArray(raw)) return [];
    return raw.map((u: any) => ({ ...u, id: String(u.id) }));
  },
  createUser: (data: CreateUserRequest) =>
    fetchAPI<User>("/users/", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: UpdateUserRequest) =>
    fetchAPI<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Courses
  getCourses: () => fetchAPI<any[]>("/courses/"),
  getCourse: (id: string) => fetchAPI<any>(`/courses/${id}`),
  createCourse: (data: any) =>
    fetchAPI<any>("/courses/", { method: "POST", body: JSON.stringify(data) }),

  // Modules
  getModules: (courseId: string) =>
    fetchAPI<any[]>(`/modules/?course_id=${courseId}`),
  createModule: (courseId: string, data: any) =>
    fetchAPI<any>(`/modules/`, {
      method: "POST",
      body: JSON.stringify({ ...data, course_id: courseId }),
    }),

  // Course stats
  getCourseStats: (courseId: string) =>
    fetchAPI<any>(`/courses/${courseId}/stats`),

  // Evaluations
  submitEvaluation: (data: { enrollment_id: number; module_id: number; answers: Array<{ question_index: number; selected: any }> }) =>
    fetchAPI<{
      module_id: number;
      enrollment_id: number;
      score: number;
      passed: boolean;
      correct: number;
      total: number;
      attempts: number;
      next_module_unlocked: boolean;
    }>("/evaluations/submit", { method: "POST", body: JSON.stringify(data) }),

  getCourseProgress: (enrollmentId: number) =>
    fetchAPI<Array<{
      id: number;
      enrollment_id: number;
      module_id: number;
      completed: boolean;
      passed: boolean;
      score: number | null;
      attempts: number;
      completed_at: string | null;
    }>>(`/evaluations/progress/${enrollmentId}`),

  canAccessModule: (enrollmentId: number, moduleId: number) =>
    fetchAPI<{ can_access: boolean; reason: string; required_module_id?: number }>(
      `/evaluations/can-access/${enrollmentId}/${moduleId}`
    ),

  getEvaluations: (moduleId: string | number) =>
    fetchAPI<any[]>(`/evaluations/?module_id=${moduleId}`),

  createEvaluation: (data: CreateEvaluationRequest) =>
    fetchAPI<Evaluation>("/evaluations/", { method: "POST", body: JSON.stringify(data) }),

  updateEvaluation: (id: number | string, data: UpdateEvaluationRequest) =>
    fetchAPI<Evaluation>(`/evaluations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteEvaluation: (id: number | string) =>
    fetchAPI<void>(`/evaluations/${id}`, { method: "DELETE" }),

  getEvaluationAnalytics: (courseId: string | number) =>
    fetchAPI<EvaluationAnalytics>(`/evaluations/analytics/${courseId}`),

  getEvaluationResponses: (courseId: string | number) =>
    fetchAPI<EmployeeResponse[]>(`/evaluations/responses/${courseId}`),

  getEvaluationResponsesUser: (userId: string | number, courseId: string | number) =>
    fetchAPI<UserResponseDetail[]>(`/evaluations/responses/user/${userId}/${courseId}`),

  // AI Generation
  generateAudio: (courseId: string | number, voiceId?: string) =>
    fetchAPI<any>("/courses/ai/generate-audio", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, voice_id: voiceId || "default" }),
    }),
  generateVideo: (courseId: string | number) =>
    fetchAPI<any>("/courses/ai/generate-video", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId }),
    }),

  regenerateModuleAudio: (moduleId: number | string, voiceId?: string) =>
    fetchAPI<any>(`/courses/ai/regenerate-module/${moduleId}/audio${voiceId ? `?voice_id=${voiceId}` : ''}`, {
      method: "POST",
    }),

  regenerateModuleVideo: (moduleId: number | string, avatarId?: string) =>
    fetchAPI<any>(`/courses/ai/regenerate-module/${moduleId}/video${avatarId ? `?avatar_id=${avatarId}` : ''}`, {
      method: "POST",
    }),

  generateVideoV2: (courseId: number, avatarId?: string) =>
    fetchAPI<any>("/courses/ai/generate-video-v2", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, avatar_id: avatarId }),
    }),

  checkVideoStatus: (moduleId: string | number) =>
    fetchAPI<{ module_id: number; status: string; video_url?: string; error?: string }>(
      `/courses/ai/video-status/${moduleId}`
    ),

  checkAllVideos: (courseId: string | number) =>
    fetchAPI<{ results: Array<{ module_id: number; status: string; video_url?: string }> }>(
      `/courses/ai/check-all-videos/${courseId}`,
      { method: "POST" }
    ),

  // Collaborator endpoints
  myCourses: () =>
    fetchAPI<Array<{
      enrollment_id: number;
      course_id: number;
      course_title: string;
      course_description: string;
      status: string;
      progress_pct: number;
      total_modules: number;
      completed_modules: number;
      enrolled_at: string;
    }>>("/enrollments/my-courses/list"),

  myCourseDetail: (courseId: string | number) =>
    fetchAPI<{
      enrollment_id: number;
      course: { id: number; title: string; description: string };
      progress_pct: number;
      total_modules: number;
      completed_modules: number;
      modules: Array<{
        id: number;
        title: string;
        order: number;
        content_text: string | null;
        video_url: string | null;
        audio_url: string | null;
        can_access: boolean;
        passed: boolean;
        score: number | null;
        attempts: number;
        completed_at: string | null;
      }>;
    }>(`/enrollments/my-course/${courseId}`),

  enrollSelf: (courseId: number) =>
    fetchAPI<{ message: string; enrollment_id: number }>(
      `/enrollments/enroll?course_id=${courseId}`,
      { method: "POST" }
    ),

  // Enrollments
  getEnrollments: (userId?: string) =>
    fetchAPI<any[]>(
      userId ? `/enrollments?user_id=${userId}` : "/enrollments/"
    ),
  enroll: (courseId: string, userId: string) =>
    fetchAPI<any>("/enrollments/", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, user_id: userId }),
    }),

  // Dashboard
  getAdminDashboard: () => fetchAPI<any>("/dashboards/admin"),
  getCollaboratorDashboard: (userId: string) =>
    fetchAPI<any>(`/dashboards/collaborator/${userId}`),
};
