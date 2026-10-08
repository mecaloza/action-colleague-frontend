import { expect, type APIRequestContext } from "@playwright/test";

// What the learning path specs prepare through the API, as the admin, before opening the browser.
const API = process.env.E2E_API_URL ?? "http://localhost:8001/api/v1";
const admin = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };

/** The password of the people created here. */
export const PASSWORD = "Temporal-2026";

/** An API call as the admin that fails the test on an error status. The caller says what comes back. */
export type Call = <T = unknown>(method: "post" | "put" | "patch" | "get", path: string, data?: unknown) => Promise<T>;

export interface CourseRef {
  id: number;
  title: string;
}

export interface Person {
  id: number;
  name: string;
  email: string;
}

export async function adminApi(request: APIRequestContext): Promise<Call> {
  const login = await request.post(`${API}/auth/login`, { data: admin });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  return async <T = unknown>(method: "post" | "put" | "patch" | "get", path: string, data?: unknown): Promise<T> => {
    const response = await request[method](`${API}${path}`, { headers, data });
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy();
    return (await response.json()) as T;
  };
}

/** A published course with one reading, completed with "Marcar como completado". */
export async function publishedCourse(call: Call, title: string): Promise<CourseRef> {
  const course = await call<CourseRef>("post", "/courses", { title, description: "Un paso de la ruta." });
  await call("post", `/courses/${course.id}/modules`, { title: `Lectura: ${title}`, content_text: "Lo que hay que saber." });
  await call("post", `/courses/${course.id}/publish`);
  return course;
}

/** A collaborator of their own (the shared learner never gets a path: other specs read its course list). */
export function newLearner(call: Call, name: string, extra: Record<string, unknown> = {}): Promise<Person> {
  const email = `ruta.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@local.test`;
  return call<Person>("post", "/users", { name, email, password: PASSWORD, role: "collaborator", ...extra });
}
