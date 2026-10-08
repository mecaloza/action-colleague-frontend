import { http } from "./client";
import type { PathDetail, PathPerson, PathRow, PathSettings, PathStatus } from "./types";

export interface PathInput {
  title: string;
  description?: string;
}

/** What a save changes: only the keys sent (`settings` too, key by key). `profile_ids` replaces the linked ones. */
export interface PathUpdate {
  title?: string;
  description?: string;
  status?: PathStatus;
  settings?: Partial<PathSettings>;
  profile_ids?: number[];
}

export interface PathListParams {
  /** Without it, archived paths are left out (as in the course library). */
  status?: PathStatus;
}

/** Courses a path can have (PathCoursesPut.course_ids max_length). */
export const MAX_PATH_COURSES = 30;

export const pathsApi = {
  list: (params: PathListParams = {}) => http.get<PathRow[]>("/paths", { ...params }),
  get: (id: number) => http.get<PathDetail>(`/paths/${id}`),
  create: (input: PathInput) => http.post<PathDetail>("/paths", input),
  update: (id: number, input: PathUpdate) => http.patch<PathDetail>(`/paths/${id}`, input),
  /** The path's courses, in order (the whole list: to add, remove or reorder). */
  setCourses: (id: number, courseIds: number[]) => http.put<PathDetail>(`/paths/${id}/courses`, { course_ids: courseIds }),
  remove: (id: number) => http.delete(`/paths/${id}`),

  people: (id: number) => http.get<PathPerson[]>(`/paths/${id}/people`),
  /** Assigns the path by hand; returns those people. */
  addPeople: (id: number, userIds: number[]) => http.post<PathPerson[]>(`/paths/${id}/people`, { user_ids: userIds }),
  removePerson: (id: number, userId: number) => http.delete(`/paths/${id}/people/${userId}`),
};

export const pathKeys = {
  all: ["paths"] as const,
  lists: ["paths", "list"] as const,
  list: (params: PathListParams) => ["paths", "list", params] as const,
  detail: (id: number) => ["paths", id] as const,
  people: (id: number) => ["paths", id, "people"] as const,
};
