import { test, expect, type APIRequestContext } from "@playwright/test";
import { DECISION, INSPECTION, PIXEL_PNG, QUICK_ORDER, SIMULATOR } from "./fixtures/activities";

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

  // The module completes through its activity: no "mark as done" button.
  await expect(page.getByRole("heading", { name: "Actividades" })).toBeVisible();
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

async function uploadPicture(call: Awaited<ReturnType<typeof adminApi>>, request: APIRequestContext, courseId: number) {
  const created = await call("post", "/media/uploads", {
    filename: "desgaste.png",
    mime_type: "image/png",
    size_bytes: PIXEL_PNG.length,
    kind: "image",
    course_id: courseId,
  });
  const put = await request.fetch(created.upload.url, {
    method: created.upload.method,
    headers: created.upload.headers,
    data: PIXEL_PNG,
  });
  expect(put.ok()).toBeTruthy();
  await call("post", `/media/${created.asset.id}/complete`, { purpose: "course_cover" });
  await expect
    .poll(async () => (await call("get", `/media/${created.asset.id}`)).status, { timeout: 30_000 })
    .toBe("ready");
  return created.asset.id as string;
}

test("inspección, simulador y reto rápido: se juegan y cuentan", async ({ page, request }) => {
  const title = `Llantas: juegos ${Date.now()}`;
  const call = await adminApi(request);
  const course = await call("post", "/courses", { title, description: "Juegos de práctica." });
  const module = await call("post", `/courses/${course.id}/modules`, {
    title: "Práctica",
    content_text: "Diagnóstico y costo.",
  });
  const inspection = await call("post", `/modules/${module.id}/activities`, {
    type: "inspection",
    title: "Encuentra el desgaste",
    spec: INSPECTION,
  });
  await call("put", `/activities/${inspection.id}/image`, { asset_id: await uploadPicture(call, request, course.id) });
  await call("put", `/activities/${inspection.id}`, { spec: INSPECTION, status: "ready" }); // zones placed again
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
  await expect(page.getByText("Te faltan 3 actividades")).toBeVisible();
  const game = page.getByRole("dialog");

  // Inspection: taps on the picture, checked by the server.
  await page.getByRole("button", { name: "Jugar: Encuentra el desgaste" }).click();
  await game.getByRole("button", { name: /Empezar/ }).click();
  const picture = game.getByRole("application", { name: /Imagen para inspeccionar/ });
  await expect(picture).toBeVisible();
  const box = (await picture.boundingBox())!;
  const tapAt = (x: number, y: number) => page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await tapAt(0.8, 0.25);
  await expect(game.getByText("Desgaste parejo: aquí no hay problema")).toBeVisible();
  await tapAt(0.15, 0.25);
  await expect(game.getByText("¡Encontraste un problema: Hombros gastados!")).toBeVisible();
  // The last one with the keyboard: the crosshair starts at the middle; up ten times (2 % each) reaches the center zone.
  await picture.focus();
  for (let i = 0; i < 10; i += 1) await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(game.getByText("Desgaste en el centro: exceso de presión.")).toBeVisible();
  await game.getByRole("button", { name: /Ver resultado/ }).click();
  await expect(game.getByRole("status").filter({ hasText: "/ 20" })).toContainText("17"); // 20 - 3 for the sound zone
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
