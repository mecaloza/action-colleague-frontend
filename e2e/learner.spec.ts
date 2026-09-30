import { test, expect, type APIRequestContext } from "@playwright/test";

// The learner's side: a course prepared through the API, then taken in the browser.
const API = process.env.E2E_API_URL ?? "http://localhost:8001/api/v1";
const admin = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };
const learner = { email: process.env.E2E_LEARNER_EMAIL ?? "", password: process.env.E2E_LEARNER_PASSWORD ?? "" };

test.use({ storageState: { cookies: [], origins: [] } }); // signed in as the learner, not the admin
test.skip(!learner.email || !learner.password, "Define E2E_LEARNER_EMAIL y E2E_LEARNER_PASSWORD para probar al colaborador.");
test.setTimeout(120_000);

async function adminApi(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, { data: admin });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  return async (method: "post" | "put" | "get", path: string, data?: unknown) => {
    const response = await request[method](`${API}${path}`, { headers, data });
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy();
    return response.json();
  };
}

async function prepareCourse(request: APIRequestContext, title: string) {
  const call = await adminApi(request);
  const course = await call("post", "/courses", { title, description: "Lo básico para trabajar seguro." });
  const modules = [];
  for (const [name, text] of [
    ["Bienvenida", "## Hola\n\nEn este curso verás:\n\n- Por qué usar casco\n- Cómo reportar"],
    ["Seguridad", "El **casco** es obligatorio en toda la planta."],
    ["Cierre", "Gracias por completar el curso."],
  ]) {
    modules.push(await call("post", `/courses/${course.id}/modules`, { title: name, content_text: text }));
  }
  await call("put", `/modules/${modules[1].id}/evaluation`, {
    questions: [
      { id: "q1", type: "true_false", prompt: "El casco es obligatorio en la planta", correct: true, explanation: "Siempre." },
      { id: "q2", type: "single_choice", prompt: "¿Qué te proteges con el casco?", options: ["La cabeza", "Las manos", "Los pies"], correct_index: 0 },
    ],
    max_attempts: 3,
    passing_score: 100,
  });
  await call("post", `/courses/${course.id}/publish`);
  const [person] = await call("get", `/users?q=${encodeURIComponent(learner.email)}`);
  await call("post", `/courses/${course.id}/participants`, { user_ids: [person.id] });
  return course;
}

test("un colaborador toma un curso de principio a fin", async ({ page, request }) => {
  const title = `Seguridad para colaboradores ${Date.now()}`;
  await prepareCourse(request, title);

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(learner.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(learner.password);
  await page.getByRole("button", { name: /Ingresar/ }).click();
  await expect(page).toHaveURL(/\/learn$/);

  // My courses: the new course waits to be started.
  await page.getByRole("link", { name: new RegExp(title) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // Module 1: a Markdown reading, completed by hand.
  await expect(page.getByRole("heading", { name: "Hola" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Seguridad/ })).toBeDisabled(); // locked until module 1 is done
  await page.getByRole("button", { name: /Marcar como completado/ }).click();

  // Module 2: its quiz, failed once and then passed.
  await expect(page.getByRole("heading", { level: 2, name: "Seguridad" })).toBeVisible();
  await page.getByRole("button", { name: /Presentar evaluación/ }).click();
  const quiz = page.getByRole("dialog");
  await quiz.getByRole("radio", { name: "Falso" }).click();
  await quiz.getByRole("button", { name: /Siguiente/ }).click();
  await quiz.getByRole("radio", { name: /Las manos/ }).click();
  await quiz.getByRole("button", { name: /Enviar respuestas/ }).click();
  await expect(quiz.getByRole("heading", { name: "Aún no alcanzas el puntaje" })).toBeVisible();
  await expect(quiz.getByText(/Respuesta correcta:/)).toHaveCount(0); // no solutions before passing

  await quiz.getByRole("button", { name: /Intentar de nuevo/ }).click();
  await quiz.getByRole("radio", { name: "Verdadero" }).click();
  await quiz.getByRole("button", { name: /Siguiente/ }).click();
  await quiz.getByRole("radio", { name: /La cabeza/ }).click();
  await quiz.getByRole("button", { name: /Enviar respuestas/ }).click();
  await expect(quiz.getByRole("heading", { name: "¡Aprobaste!" })).toBeVisible();
  await quiz.getByRole("button", { name: /Siguiente módulo/ }).click();

  // Module 3 finishes the course.
  await expect(page.getByRole("heading", { level: 2, name: "Cierre" })).toBeVisible();
  await page.getByRole("button", { name: /Marcar como completado/ }).click();
  await expect(page.getByRole("heading", { name: "¡Completaste el curso!" })).toBeVisible();
  await page.getByRole("link", { name: "Volver a mis cursos" }).click();
  await expect(page.getByRole("heading", { name: /Completados/ })).toBeVisible();

  // Profile: the name shown to administrators.
  await page.goto("/profile");
  await page.getByLabel("Nombre").fill("Colaborador E2E");
  await page.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(page.getByText("Nombre actualizado")).toBeVisible();
});
