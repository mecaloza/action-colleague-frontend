import { apiRequest, http } from "./client";
import type { AttemptResult, CompletionResult, LearnerCourse, LearnerCourseDetail, LearnerQuiz, QuizAnswer } from "./types";

export const learnApi = {
  courses: () => http.get<LearnerCourse[]>("/learn/courses"),
  course: (courseId: number) => http.get<LearnerCourseDetail>(`/learn/courses/${courseId}`),
  quiz: (moduleId: number) => http.get<LearnerQuiz>(`/learn/modules/${moduleId}/quiz`),
  submit: (moduleId: number, answers: QuizAnswer[], version: string) =>
    http.post<AttemptResult>(`/learn/modules/${moduleId}/quiz/attempts`, { answers, version }),
  complete: (moduleId: number) => http.post<CompletionResult>(`/learn/modules/${moduleId}/complete`),
  savePosition: (moduleId: number, seconds: number, keepalive = false) =>
    apiRequest<void>(`/learn/modules/${moduleId}/position`, { method: "PUT", body: { seconds }, keepalive }),
};

export const learnKeys = {
  all: ["learn"] as const,
  courses: ["learn", "courses"] as const,
  course: (courseId: number) => ["learn", "course", courseId] as const,
  quiz: (moduleId: number) => ["learn", "quiz", moduleId] as const,
};
