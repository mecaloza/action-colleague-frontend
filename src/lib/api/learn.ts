import { apiRequest, http } from "./client";
import type {
  ActivityFinish,
  ActivityMoveResult,
  ActivityPlay,
  AttemptResult,
  CompletionResult,
  LearnerCertificate,
  LearnerCourse,
  LearnerCourseDetail,
  LearnerPath,
  LearnerQuiz,
  LearnerRanking,
  LearnerSettings,
  QuizAnswer,
  RankingPeriod,
} from "./types";

export interface LearnerRankingParams {
  period: RankingPeriod;
  /** One of my published paths (403 for any other); without it, over every course. */
  path_id?: number;
}

export const learnApi = {
  courses: () => http.get<LearnerCourse[]>("/learn/courses"),
  /** My published learning paths, oldest assignment first. */
  paths: () => http.get<LearnerPath[]>("/learn/paths"),
  /** Every certificate I earned, newest first: valid, expired or revoked. */
  certificates: () => http.get<LearnerCertificate[]>("/learn/certificates"),
  /** What the app needs of the platform's parameters (whether the ranking shows). */
  settings: () => http.get<LearnerSettings>("/learn/settings"),
  /** The top 10 of the period and my place. */
  ranking: (params: LearnerRankingParams) => http.get<LearnerRanking>("/learn/ranking", { ...params }),
  course: (courseId: number) => http.get<LearnerCourseDetail>(`/learn/courses/${courseId}`),
  quiz: (moduleId: number) => http.get<LearnerQuiz>(`/learn/modules/${moduleId}/quiz`),
  submit: (moduleId: number, answers: QuizAnswer[], version: string) =>
    http.post<AttemptResult>(`/learn/modules/${moduleId}/quiz/attempts`, { answers, version }),
  complete: (moduleId: number) => http.post<CompletionResult>(`/learn/modules/${moduleId}/complete`),
  savePosition: (moduleId: number, seconds: number, keepalive = false) =>
    apiRequest<void>(`/learn/modules/${moduleId}/position`, { method: "PUT", body: { seconds }, keepalive }),
  /** Start a play of an activity, or resume the one left open. */
  startActivity: (activityId: number, untimed = false) =>
    http.post<ActivityPlay>(`/learn/activities/${activityId}/attempts`, { untimed }),
  move: (attemptId: number, move: Record<string, unknown>) =>
    http.post<ActivityMoveResult>(`/learn/activity-attempts/${attemptId}/moves`, { move }),
  finishActivity: (attemptId: number) => http.post<ActivityFinish>(`/learn/activity-attempts/${attemptId}/finish`),
};

export const learnKeys = {
  all: ["learn"] as const,
  courses: ["learn", "courses"] as const,
  paths: ["learn", "paths"] as const,
  certificates: ["learn", "certificates"] as const,
  settings: ["learn", "settings"] as const,
  ranking: (params: LearnerRankingParams) => ["learn", "ranking", params] as const,
  /** Every course opened in the player. */
  courseDetails: ["learn", "course"] as const,
  course: (courseId: number) => ["learn", "course", courseId] as const,
  quiz: (moduleId: number) => ["learn", "quiz", moduleId] as const,
};
