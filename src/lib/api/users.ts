import { http } from "./client";
import type { LearnerCourse, Role, UserRow } from "./types";

export interface UserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  position: string;
  department: string;
}

export interface UserListParams {
  q?: string;
  role?: Role;
  include_inactive?: boolean;
}

export const usersApi = {
  list: (params: UserListParams = {}) => http.get<UserRow[]>("/users", { ...params }),
  create: (input: UserInput) => http.post<UserRow>("/users", input),
  update: (id: number, input: Partial<UserInput> & { is_active?: boolean }) => http.patch<UserRow>(`/users/${id}`, input),
  courses: (id: number) => http.get<LearnerCourse[]>(`/users/${id}/courses`),
};

export const userKeys = {
  all: ["users"] as const,
  list: (params: UserListParams) => ["users", "list", params] as const,
  courses: (id: number) => ["users", id, "courses"] as const,
};
