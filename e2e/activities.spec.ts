import { test, expect, type APIRequestContext } from "@playwright/test";
import { DECISION, INSPECTION, QUICK_ORDER, SIMULATOR } from "./fixtures/activities";

// Interactive activities after a module's video, played by a learner.
const API = process.env.E2E_API_URL ?? "http://localhost:8001/api/v1";
const admin = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };
const learner = { email: process.env.E2E_LEARNER_EMAIL ?? "", password: process.env.E2E_LEARNER_PASSWORD ?? "" };

test.use({ storageState: { cookies: [], origins: [] } });
test.skip(
  !learner.email || !learner.password,
  "Define E2E_LEARNER_EMAIL y E2E_LEARNER_PASSWORD para probar al colaborador.",
);
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

async function courseWithActivities(request: APIRequestContext, title: string) {
  const call = await adminApi(request);
  const course = await call("post", "/courses", { title, description: "Asesoría de llantas." });
  const first = await call("post", `/courses/${course.id}/modules`, {
    title: "Ventas",
    content_text: "Cómo vender por costo por kilómetro.",
  });
  await call("post", `/courses/${course.id}/modules`, { title: "Cierre", content_text: "Gracias." });
  await call("post", `/modules/${first.id}/activities`, {
    type: "decision",
    title: "Cliente que solo pide precio",
    intro: "Atiende al cliente.",
    spec: DECISION,
    status: "ready",
  });
  await call("post", `/courses/${course.id}/publish`);
  const [person] = await call("get", `/users?q=${encodeURIComponent(learner.email)}`);
  await call("post", `/courses/${course.id}/participants`, { user_ids: [person.id] });
}

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(learner.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(learner.password);
  await page.getByRole("button", { name: /Ingresar/ }).click();
  await expect(page).toHaveURL(/\/learn$/, { timeout: 20_000 }); // a cold route
}

test("un colaborador juega la conversación con el cliente y completa el módulo", async ({ page, request }) => {
  const title = `Llantas con actividades ${Date.now()}`;
  await courseWithActivities(request, title);
  await signIn(page);
  await page
    .getByRole("link", { name: new RegExp(title) })
    .first()
    .click();
  // The course page is a cold route under `next dev`: its first visit waits for it to compile.
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 20_000 });

  // The module completes through its activity: no "mark as done" button.
  // Exact: the course title heading ("Llantas con actividades…") also holds the word.
  await expect(page.getByRole("heading", { name: "Actividades", exact: true })).toBeVisible();
  await expect(page.getByText("Te falta 1 actividad")).toBeVisible();
  await expect(page.getByRole("button", { name: /Marcar como completado/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Jugar: Cliente que solo pide precio" }).click();
  const game = page.getByRole("dialog");
  await expect(game.getByRole("heading", { name: "Cliente que solo pide precio" })).toBeVisible();
  await game.getByRole("button", { name: /Empezar/ }).click();

  await expect(game.getByText("Solo quiero la llanta más barata para mi flota.")).toBeVisible();
  await expect(game.getByText("Entiendes la aplicación")).toHaveCount(0); // consequences only after choosing
  await game.getByRole("button", { name: "¿Qué ruta y carga manejan?" }).click();
  await expect(game.getByText("Entiendes la aplicación antes de cotizar.")).toBeVisible();
  await expect(game.getByText("+6 puntos")).toBeVisible();

  await game.getByRole("button", { name: "Le muestro el costo por kilómetro." }).click();
  await expect(game.getByText("El cliente ve el ahorro en números.")).toBeVisible();
  await game.getByRole("button", { name: /Ver resultado/ }).click();
  await expect(game.getByText("¡Excelente!")).toBeVisible();
  await expect(game.getByText("Completaste el módulo.")).toBeVisible();
  await game.getByRole("button", { name: "Continuar" }).click();

  // Closing the finished game moves on to the next module, now unlocked.
  await expect(page.getByRole("heading", { level: 2, name: "Cierre" })).toBeVisible();
  await page.getByRole("button", { name: /Ventas/ }).click();
  await expect(page.getByText("10 de 10 puntos")).toBeVisible();
});

test("inspección, simulador y reto rápido: se juegan y cuentan", async ({ page, request }) => {
  const title = `Llantas: juegos ${Date.now()}`;
  const call = await adminApi(request);
  const course = await call("post", "/courses", { title, description: "Juegos de práctica." });
  const module = await call("post", `/courses/${course.id}/modules`, {
    title: "Práctica",
    content_text: "Diagnóstico y costo.",
  });
  await call("post", `/modules/${module.id}/activities`, {
    type: "inspection",
    title: "Revisa la unidad",
    spec: INSPECTION,
    status: "ready",
  });
  await call("post", `/modules/${module.id}/activities`, {
    type: "simulator",
    title: "Baja el costo por km",
    spec: SIMULATOR,
    status: "ready",
  });
  await call("post", `/modules/${module.id}/activities`, {
    type: "quick",
    title: "Revisión en patio",
    spec: QUICK_ORDER,
    status: "ready",
  });
  await call("post", `/courses/${course.id}/publish`);
  const [person] = await call("get", `/users?q=${encodeURIComponent(learner.email)}`);
  await call("post", `/courses/${course.id}/participants`, { user_ids: [person.id] });

  await signIn(page);
  await page
    .getByRole("link", { name: new RegExp(title) })
    .first()
    .click();
  // The course page is a cold route under `next dev`: its first visit waits for it to compile.
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Te faltan 3 actividades")).toBeVisible();
  const game = page.getByRole("dialog");

  // Inspection: each tire's facts, a decision per tire (keyboard or mouse), graded by the server.
  await page.getByRole("button", { name: "Jugar: Revisa la unidad" }).click();
  await game.getByRole("button", { name: /Empezar/ }).click();
  await expect(game.getByRole("heading", { name: "Llanta 1 · direccional izquierda" })).toBeVisible();
  await expect(game.getByText("110 psi")).toBeVisible();
  await expect(game.getByText("Desgaste parejo y buena profundidad")).toHaveCount(0); // the answer only after deciding
  await page.keyboard.press("1"); // "Sigue rodando"
  await expect(game.getByText("¡Bien! Sigue rodando")).toBeVisible();
  await page.keyboard.press("Enter"); // "Siguiente" has the focus
  await expect(game.getByRole("heading", { name: "Llanta 2 · direccional derecha" })).toBeVisible();
  await game.getByRole("button", { name: "Sigue rodando" }).click();
  await expect(game.getByText("No: lo correcto era Reencauchar")).toBeVisible();
  await expect(game.getByRole("img", { name: "2 de 3 vidas" })).toBeVisible();
  await game.getByRole("button", { name: "Llanta 3 · tracción izquierda: pendiente" }).click();
  await page.keyboard.press("3"); // "Retirar"
  await expect(game.getByText("Un chipote es una ruptura interna")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(game.getByRole("heading", { name: "Llanta 4 · tracción derecha" })).toBeVisible();
  await page.keyboard.press("1");
  await expect(game.getByText(/Acertaste 3 de 4/)).toBeVisible();
  await game.getByRole("button", { name: /Ver resultado/ }).click();
  await expect(game.getByRole("status").filter({ hasText: "/ 52" })).toContainText("32"); // 10 + 10 + 12 (a streak of 2)
  await game.getByRole("button", { name: "Continuar" }).click();

  // Simulator: the live result follows the slider; the server confirms the target.
  await page.getByRole("button", { name: "Jugar: Baja el costo por km" }).click();
  await game.getByRole("button", { name: /Empezar/ }).click();
  await expect(game.getByText("0.060")).toBeVisible();
  await game.getByRole("slider", { name: "Kilómetros de vida" }).focus();
  await page.keyboard.press("End");
  await expect(game.getByText("0.024")).toBeVisible();
  await game.getByRole("button", { name: /Probar estos valores/ }).click();
  await expect(game.getByText("Así se vende: más vida útil, menos costo por kilómetro.")).toBeVisible();
  await game.getByRole("button", { name: /Ver resultado/ }).click();
  await expect(game.getByText("¡Excelente!")).toBeVisible();
  await game.getByRole("button", { name: "Continuar" }).click();

  // Quick challenge, without its clock: tap the steps in order.
  await page.getByRole("button", { name: "Jugar: Revisión en patio" }).click();
  await game.getByLabel(/sin límite de tiempo/).check();
  await game.getByRole("button", { name: /Empezar/ }).click();
  await expect(game.getByRole("button", { name: "Leer el DOT" })).toBeVisible(); // on screen, with its clock if any
  await expect(game.getByRole("timer")).toHaveCount(0);
  await game.getByRole("button", { name: "Leer el DOT" }).click(); // not the first step
  await expect(game.getByText("Racha 0")).toBeVisible();
  for (const step of QUICK_ORDER.items) {
    await game.getByRole("button", { name: step }).click();
    await expect(game.getByRole("button", { name: step })).toBeDisabled(); // placed before the next tap
  }
  await expect(game.getByText("Racha 4")).toBeVisible();
  await game.getByRole("button", { name: /Ver resultado/ }).click();
  await expect(game.getByText("Completaste el módulo.")).toBeVisible();
});
