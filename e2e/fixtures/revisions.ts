import type { APIRequestContext } from "@playwright/test";
import { DECISION } from "./activities";
import { type Call, learnerApi, newLearner } from "./api";

// Modules whose quiz or activities the specs ask the AI to change, prepared through the API. With the fake providers,
// a change to a quiz rewords the questions in scope ("Revisado: …"; the first one when none is chosen), or only their
// explanation when the observation says "explicación", and also adds a true/false question after them when it says
// "agrega". A change to an activity rewords its intro and, in a conversation, adds " Revisado." to the first choice's
// consequence (in other kinds it rewords the instruction); "título" in the observation retitles it too.

export const MODULE_TITLE = "Uso del casco";

/** A quiz of three questions: two statements around a choice. */
export const QUESTIONS = [
  {
    id: "q1",
    type: "true_false",
    prompt: "El casco se usa siempre en la planta",
    correct: true,
    explanation: "Siempre puesto, también en la bodega.",
  },
  {
    id: "q2",
    type: "single_choice",
    scenario: "",
    prompt: "¿Cuándo se revisa el casco?",
    options: ["Antes de cada turno", "Una vez al mes", "Solo si se cae"],
    correct_index: 0,
    explanation: "Antes de cada turno, sin excepción.",
  },
  {
    id: "q3",
    type: "true_false",
    prompt: "Un casco golpeado se puede seguir usando",
    correct: false,
    explanation: "Se cambia aunque no se vea dañado.",
  },
];

/** A course (not published) with one module: its reading and a quiz with `QUESTIONS` (3 attempts, 70% to pass). */
export async function quizCourse(call: Call, title: string) {
  const course = await call<{ id: number }>("post", "/courses", { title: `${title} ${Date.now()}` });
  const module = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: MODULE_TITLE,
    content_text: "El casco se usa siempre en la planta y se revisa antes de cada turno.",
  });
  await call("put", `/modules/${module.id}/evaluation`, { questions: QUESTIONS, max_attempts: 3, passing_score: 70 });
  return { courseId: course.id, moduleId: module.id };
}

/** The module's quiz as saved: its questions in order. */
export async function savedQuestions(call: Call, moduleId: number) {
  const evaluation = await call<{ questions: { id: string; prompt: string; explanation: string }[] }>(
    "get",
    `/modules/${moduleId}/evaluation`,
  );
  return evaluation.questions;
}

export const ACTIVITY_TITLE = "Cliente que solo pide precio";
export const ACTIVITY_INTRO = "Atiende al cliente y decide qué hacer.";

interface ActivitySeed {
  type?: string;
  title?: string;
  spec?: unknown;
  status?: "draft" | "ready";
}

/** An activity of the module (by default the conversation `DECISION`, published), with an intro. */
export async function addActivity(call: Call, moduleId: number, seed: ActivitySeed = {}) {
  const { type = "decision", title = ACTIVITY_TITLE, spec = DECISION, status = "ready" } = seed;
  return call<{ id: number; title: string }>("post", `/modules/${moduleId}/activities`, {
    type,
    title,
    intro: ACTIVITY_INTRO,
    spec,
    status,
  });
}

/** A course (not published) with one module and one activity (see `addActivity`). */
export async function activityCourse(call: Call, title: string, seed: ActivitySeed = {}) {
  const course = await call<{ id: number }>("post", "/courses", { title: `${title} ${Date.now()}` });
  const module = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: MODULE_TITLE,
    content_text: "Cómo atender al cliente que solo pregunta por el precio.",
  });
  const activity = await addActivity(call, module.id, seed);
  return { courseId: course.id, moduleId: module.id, activityId: activity.id };
}

interface SavedActivity {
  id: number;
  title: string;
  intro: string;
  version: number;
  spec: Record<string, unknown>;
}

/** The activity as saved. */
export async function savedActivity(call: Call, moduleId: number, activityId: number) {
  const activities = await call<SavedActivity[]>("get", `/modules/${moduleId}/activities`);
  const activity = activities.find((each) => each.id === activityId);
  if (!activity) throw new Error(`La actividad ${activityId} no está en el módulo ${moduleId}`);
  return activity;
}

/** The course published, with a person of its own taking it: their calls (as that person). */
export async function publishedWithLearner(call: Call, request: APIRequestContext, courseId: number) {
  await call("post", `/courses/${courseId}/publish`);
  const learner = await newLearner(call, `Persona a mitad del curso ${Date.now()}`);
  await call("post", `/courses/${courseId}/participants`, { user_ids: [learner.id] });
  return learnerApi(request, learner.email);
}
