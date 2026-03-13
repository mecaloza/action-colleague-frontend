import {
  LoginRequest,
  LoginResponse,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  OrgChartNode,
  Communication,
  CreateCommunicationRequest,
  GenerateImageResponse,
  Evaluation,
  CreateEvaluationRequest,
  UpdateEvaluationRequest,
  EvaluationAnalytics,
  EmployeeResponse,
  UserResponseDetail,
} from "@/lib/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://colleague-backend-production.up.railway.app/api/v1";

const API_COMMS = API_BASE.replace(/\/v\d+$/, "/communications");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ac_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ac_refresh_token");
}

function clearAuth() {
  localStorage.removeItem("ac_token");
  localStorage.removeItem("ac_refresh_token");
  localStorage.removeItem("ac_user");
}

// Module-level promise to deduplicate concurrent refresh calls
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token");

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearAuth();
      throw new Error("Refresh failed");
    }

    const data = await res.json();
    localStorage.setItem("ac_token", data.access_token);
    localStorage.setItem("ac_refresh_token", data.refresh_token);
    return data.access_token as string;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token && !options?.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...options,
    headers,
  });

  // On 401, attempt token refresh and retry once
  if (res.status === 401 && !options?.skipAuth) {
    try {
      const newToken = await refreshAccessToken();
      headers["Authorization"] = `Bearer ${newToken}`;
      const retryRes = await fetch(url, { ...options, headers });
      if (!retryRes.ok) {
        const errorBody = await retryRes.text().catch(() => "");
        throw new Error(
          `API Error: ${retryRes.status} ${retryRes.statusText} ${errorBody}`
        );
      }
      return retryRes.json();
    } catch {
      // Refresh failed — redirect to login
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `API Error: ${res.status} ${res.statusText} ${errorBody}`
    );
  }
  return res.json();
}

export const api = {
  // Auth
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const url = `${API_BASE}/auth/login`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 422) {
          throw new Error("Invalid email or password");
        }
        throw new Error(`Login failed: ${res.status}`);
      }
      const tokenData = await res.json();
      // Store tokens
      localStorage.setItem("ac_token", tokenData.access_token);
      if (tokenData.refresh_token) {
        localStorage.setItem("ac_refresh_token", tokenData.refresh_token);
      }
      // Fetch full user data
      const meRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { "Authorization": `Bearer ${tokenData.access_token}` },
      });
      const user = meRes.ok ? await meRes.json() : { id: tokenData.user_id, role: tokenData.role, name: "", email: data.email };
      return { access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, token_type: "bearer", user };
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch {
      // Best-effort server-side revocation
    } finally {
      clearAuth();
    }
  },

  getMe: () => fetchAPI<User>("/auth/me"),

  // Users (admin)
  getUsers: async (): Promise<User[]> => {
    const raw = await fetchAPI<any[]>("/users/");
    // Map reports_to -> leader_id/leader_name for frontend
    return raw.map((u: any) => ({
      ...u,
      id: String(u.id),
      leader_id: u.reports_to ? String(u.reports_to) : undefined,
      leader_name: u.reports_to
        ? raw.find((x: any) => x.id === u.reports_to)?.name || undefined
        : undefined,
    }));
  },
  createUser: (data: CreateUserRequest) => {
    const { leader_id, ...rest } = data as any;
    const payload = {
      ...rest,
      reports_to: leader_id ? parseInt(leader_id) : null,
    };
    return fetchAPI<User>("/users/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateUser: (id: string, data: UpdateUserRequest) => {
    const { leader_id, ...rest } = data as any;
    const payload: any = { ...rest };
    if (leader_id !== undefined) {
      payload.reports_to = leader_id ? parseInt(leader_id) : null;
    }
    return fetchAPI<User>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  getOrgChart: () => fetchAPI<OrgChartNode[]>("/users/org-chart"),

  // Courses
  getCourses: () => fetchAPI<any[]>("/courses/"),
  getCourse: (id: string) => fetchAPI<any>(`/courses/${id}`),
  createCourse: (data: any) =>
    fetchAPI<any>("/courses/", { method: "POST", body: JSON.stringify(data) }),
  updateCourse: (id: string, data: any) =>
    fetchAPI<any>(`/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

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
    }>("/evaluations/submit/", { method: "POST", body: JSON.stringify(data) }),

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
  updateProgress: (enrollmentId: string, progress: number) =>
    fetchAPI<any>(`/enrollments/${enrollmentId}/progress`, {
      method: "PUT",
      body: JSON.stringify({ progress }),
    }),

  // Employees
  getEmployees: () => fetchAPI<any[]>("/employees/"),
  getEmployee: (id: string) => fetchAPI<any>(`/employees/${id}`),

  // Documents
  getDocuments: (userId?: string) =>
    fetchAPI<any[]>(
      userId ? `/documents?user_id=${userId}` : "/documents"
    ),
  generateDocument: (data: any) =>
    fetchAPI<any>("/documents/generate/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Dashboard
  getAdminDashboard: () => fetchAPI<any>("/dashboards/admin"),
  getCollaboratorDashboard: (userId: string) =>
    fetchAPI<any>(`/dashboards/collaborator/${userId}`),

  // Communications
  getCommunications: async (): Promise<Communication[]> => {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(API_COMMS, { headers });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },
  createCommunication: async (data: CreateCommunicationRequest): Promise<Communication> => {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(API_COMMS, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },
  deleteCommunication: async (id: number): Promise<void> => {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_COMMS}/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
  },
  generateCommunicationImage: async (prompt: string): Promise<GenerateImageResponse> => {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_COMMS}/generate-image`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },
};
