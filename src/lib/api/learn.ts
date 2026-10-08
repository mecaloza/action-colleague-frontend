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
  QuizAnswer,
} from "./types";

export const learnApi = {
  courses: () => http.get<LearnerCourse[]>("/learn/courses"),
  /** My published learning paths, oldest assignment first. */
  paths: () => http.get<LearnerPath[]>("/learn/paths"),
  /** Every certificate I earned, newest first: valid, expired or revoked. */
  certificates: () => http.get<LearnerCertificate[]>("/learn/certificates"),
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
  /** Every course opened in the player. */
  courseDetails: ["learn", "course"] as const,
  course: (courseId: number) => ["learn", "course", courseId] as const,
  quiz: (moduleId: number) => ["learn", "quiz", moduleId] as const,
};
