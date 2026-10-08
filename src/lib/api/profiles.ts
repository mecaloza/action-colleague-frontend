import { http } from "./client";
import type { ProfileItem } from "./types";

export interface ProfileInput {
  name: string;
  description?: string;
}

export const profilesApi = {
  /** Sorted by name. */
  list: () => http.get<ProfileItem[]>("/profiles"),
  create: (input: ProfileInput) => http.post<ProfileItem>("/profiles", input),
  update: (id: number, input: Partial<ProfileInput>) => http.patch<ProfileItem>(`/profiles/${id}`, input),
  /** Its people stay without a profile: they keep their courses and the paths they completed. */
  remove: (id: number) => http.delete(`/profiles/${id}`),
};

export const profileKeys = {
  all: ["profiles"] as const,
  list: ["profiles", "list"] as const,
};
