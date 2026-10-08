import { http } from "./client";
import type { Ranking, RankingPeriod } from "./types";

export interface RankingParams {
  period: RankingPeriod;
  /** A path, in any status: its people and what they earned in its courses (404 when it doesn't exist). */
  path_id?: number;
  /** How many to list (1-100; the API's default is 20). */
  limit?: number;
}

export const rankingApi = {
  /** The admin's: who earned the most points in the period, over every course or in a path. */
  get: (params: RankingParams) => http.get<Ranking>("/ranking", { ...params }),
};

export const rankingKeys = {
  all: ["ranking"] as const,
  list: (params: RankingParams) => ["ranking", params] as const,
};
