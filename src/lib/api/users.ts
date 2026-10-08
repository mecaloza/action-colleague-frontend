import { http } from "./client";
import type { LearnerCourse, PersonOverview, QuizReset, Role, UserRow } from "./types";

export interface UserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  position: string;
  department: string;
  /** Null: no profile (on an edit, removes it). */
  profile_id: number | null;
}

export interface UserListParams {
  q?: string;
  role?: Role;
  profile_id?: number;
  include_inactive?: boolean;
}

export const usersApi = {
  list: (params: UserListParams = {}) => http.get<UserRow[]>("/users", { ...params }),
  get: (id: number) => http.get<UserRow>(`/users/${id}`),
  create: (input: UserInput) => http.post<UserRow>("/users", input),
  update: (id: number, input: Partial<UserInput> & { is_active?: boolean }) => http.patch<UserRow>(`/users/${id}`, input),
  courses: (id: number) => http.get<LearnerCourse[]>(`/users/${id}/courses`),
  /** Everything about their learning: numbers, paths, courses module by module, certificates, latest events. */
  overview: (id: number) => http.get<PersonOverview>(`/users/${id}/overview`),
  /** Gives them their attempts at a module's quiz back (409 once they passed it). */
  resetQuiz: (id: number, moduleId: number) => http.post<QuizReset>(`/users/${id}/modules/${moduleId}/quiz-reset`),
};

export const userKeys = {
  all: ["users"] as const,
  lists: ["users", "list"] as const,
  list: (params: UserListParams) => ["users", "list", params] as const,
  /** One person: their row, and below it everything about them (refreshing it refreshes those too). */
  detail: (id: number) => ["users", id] as const,
  courses: (id: number) => ["users", id, "courses"] as const,
  overview: (id: number) => ["users", id, "overview"] as const,
};
