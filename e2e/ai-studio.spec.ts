import { test, expect, type Page } from "@playwright/test";

// Runs against a backend with USE_FAKE_PROVIDERS=true: deterministic AI, voice and presenter.
test.setTimeout(240_000);

/** The API the app talks to, called as the signed-in admin (the app keeps the session token in localStorage). */
async function adminApi(page: Page) {
  const [first] = await Promise.all([
    page.waitForRequest((request) => request.url().includes("/api/v1/")),
    page.goto("/admin/courses"),
  ]);
  const base = first.url().slice(0, first.url().indexOf("/api/v1/") + "/api/v1".length);
  await expect(page.locator("h1").first()).toBeVisible(); // signed in: the stored token is current
  const token = await page.evaluate(() => localStorage.getItem("ac_token"));
  const call = async <T>(method: string, path: string, data?: unknown): Promise<T> => {
    const response = await page.request.fetch(`${base}${path}`, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return (await response.json()) as T;
  };
  return { base, call };
}

/** A video made by the previous app (it never loads: only its presence matters). */
const LEGACY_VIDEO = {
  url: "https://example.com/video.mp4",
  mime_type: "video/mp4",
  duration_seconds: 60,
  width: 1280,
  height: 720,
};

test("un admin crea un curso con IA de principio a fin", async ({ page }) => {
  await page.goto("/admin/courses/new");
  await page.getByRole("link", { name: /Crear con IA/ }).click();
  await expect(page).toHaveURL(/\/admin\/courses\/new\/ai$/);

  // 01 Brief
  await page.getByLabel("¿Qué deben aprender?").fill(
    "Seguridad en la planta para operarios nuevos: uso del casco, guantes y cómo reportar un incidente.",
  );
  await page.getByLabel("¿Para quién es?").fill("Operarios nuevos");
  await page.getByRole("button", { name: "2", exact: true }).click(); // two modules
  await page.locator('input[type="file"]').setInputFiles({
    name: "manual.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("El casco es obligatorio en toda la planta. Los incidentes se reportan el mismo día."),
  });
  await expect(page.getByText("manual.txt")).toBeVisible();
  await page.getByRole("button", { name: /Proponer estructura/ }).click();

  // 02 Structure: the AI's proposal, editable
  await expect(page).toHaveURL(/\/admin\/courses\/\d+\/studio$/, { timeout: 60_000 });
  const courseTitle = page.getByLabel("Título del curso");
  await expect(courseTitle).toHaveValue(/Curso de seguridad/i, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /^Quitar módulo \d+$/ })).toHaveCount(2);
  await courseTitle.fill("Seguridad en planta");
  await page.getByRole("button", { name: /Aprobar y escribir guiones/ }).click();

  // 03 Content: scripts written in the background, then reviewed and edited
  await expect(page.getByRole("heading", { name: "Guiones y diapositivas" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Revisar guion/ })).toHaveCount(2, { timeout: 90_000 });
  await page.getByRole("button", { name: /Revisar guion/ }).first().click();
  const narration = page.getByLabel("Narración").first();
  await narration.fill("Bienvenidos. En este módulo veremos por qué el casco es obligatorio.");
  await expect(page.getByRole("img", { name: "Diapositiva de la escena 1" })).toBeVisible();
  await page.getByRole("button", { name: /Guardar guion/ }).click();
  await expect(page.getByText("Guion guardado")).toBeVisible();
  await page.getByRole("button", { name: /Elegir voz y estilo/ }).click();

  // 04 Style and voice
  await page.getByRole("button", { name: /Voz de prueba/ }).click();
  await page.getByRole("button", { name: /Presentadora de prueba/ }).click();
  await page.getByRole("button", { name: "Claro" }).click();
  await page.getByRole("button", { name: /Producir 2 videos/ }).click();

  // 05 Production
  await expect(page.getByRole("heading", { name: "Tu curso está producido." })).toBeVisible({ timeout: 180_000 });
  await page.getByRole("button", { name: /Ver el video de/ }).first().click();
  await expect(page.getByRole("dialog").locator("video")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: /Revisar y publicar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Seguridad en planta" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Estudio IA/ })).toBeVisible();
});

test("un video fallido o un módulo sin guion no dejan el estudio sin salida", async ({ page }) => {
  const api = await adminApi(page);
  const title = `Curso de la versión anterior ${Date.now()}`;
  const course = await api.call<{ id: number }>("POST", "/courses", { title, source: "ai" });
  const scripted = await api.call<{ id: number }>("POST", `/courses/${course.id}/modules`, {
    title: "Guion listo",
    source: "ai",
  });
  const legacy = await api.call<{ id: number }>("POST", `/courses/${course.id}/modules`, {
    title: "Video anterior",
    source: "ai",
    content_text: "Lectura escrita en la versión anterior.",
  });
  await api.call("PUT", `/modules/${scripted.id}/storyboard`, {
    scenes: [{ id: "s1", slide: { layout: "cover", title: "Bienvenida" }, narration: "Bienvenidos al curso." }],
  });

  // What the API can't be asked for: the scripted module's video failed and the other one has the video the
  // previous app made, without a script. With `migrated`, the whole course is as the previous app left it.
  let migrated = false;
  await page.route(`${api.base}/courses/${course.id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const detail = await response.json();
    for (const module of detail.modules) {
      if (migrated || module.id === legacy.id) {
        Object.assign(module, { scene_count: 0, generation_status: "completed", video: LEGACY_VIDEO });
      } else if (module.id === scripted.id) {
        Object.assign(module, { generation_status: "failed", generation_error: "El servicio de voz no respondió." });
      }
    }
    await route.fulfill({ response, json: detail });
  });

  // A module with its own video doesn't hold the studio in Contenido.
  await page.goto(`/admin/courses/${course.id}/studio`);
  await expect(page.getByRole("heading", { name: "Los videos del curso" })).toBeVisible();
  const steps = page.getByRole("navigation", { name: "Pasos del estudio" });
  await steps.getByRole("button", { name: /Contenido/ }).click();
  await expect(page.getByRole("heading", { name: "Guiones y diapositivas" })).toBeVisible();

  // What failed was the video: the script stays reviewable and nothing offers to write it again.
  const scriptedRow = page.getByRole("listitem").filter({ hasText: "Guion listo" });
  await expect(scriptedRow).toContainText("La última operación falló: El servicio de voz no respondió.");
  await expect(scriptedRow.getByRole("button", { name: "Reintentar" })).toHaveCount(0);

  // A module without a script isn't "being written": it waits for the admin, who is asked before replacing its reading.
  const legacyRow = page.getByRole("listitem").filter({ hasText: "Video anterior" });
  await expect(legacyRow).toContainText("Sin guion");
  await expect(page.getByRole("button", { name: /Elegir voz y estilo/ })).toBeEnabled();
  await legacyRow.getByRole("button", { name: /Escribir guion con IA/ }).click();
  const question = page.getByRole("dialog", { name: "¿Escribir el guion con IA?" });
  await expect(question).toContainText("reemplazará su lectura");
  await expect(question).toContainText("El video actual se mantiene");
  await question.getByRole("button", { name: "Cancelar" }).click();
  await expect(question).toBeHidden();

  // The AI rewrites the saved script: not while there are edits; leaving the step with them asks first.
  await scriptedRow.getByRole("button", { name: /Revisar guion/ }).click();
  const rewrite = page.getByRole("button", { name: /Reescribir con IA/ });
  await page.getByLabel("¿Prefieres que la IA lo reescriba?").fill("Más ejemplos de la planta");
  await expect(rewrite).toBeEnabled();
  await page.getByLabel("Narración").fill("Bienvenidos a la planta.");
  await expect(rewrite).toBeDisabled();
  await expect(page.getByText(/Guarda o descarta tus cambios/)).toBeVisible();
  await steps.getByRole("button", { name: /Brief/ }).click();
  const discard = page.getByRole("dialog", { name: "¿Descartar los cambios sin guardar?" });
  await discard.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByLabel("Narración")).toHaveValue("Bienvenidos a la planta.");
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(rewrite).toBeEnabled();

  // The course links to its studio while it has scripts, not when it's all from the previous app.
  await page.goto(`/admin/courses/${course.id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("link", { name: /Estudio IA/ })).toBeVisible();
  migrated = true;
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("link", { name: /Estudio IA/ })).toHaveCount(0);
});

test("si la IA no puede proponer la estructura, el paso lo dice y deja volver al brief", async ({ page }) => {
  const api = await adminApi(page);
  const course = await api.call<{ id: number }>("POST", "/courses", {
    title: `Propuesta fallida ${Date.now()}`,
    source: "ai",
  });

  // The outline job fails: queued when asked for, failed when followed.
  const job = {
    id: `e2e-outline-${course.id}`,
    type: "ai.outline",
    status: "queued",
    progress: 0,
    step: "",
    error: null,
    course_id: course.id,
    module_id: null,
    result: null,
    created_at: null,
    updated_at: null,
  };
  const reply = (body: object, status = 200) => ({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
  await page.route(`${api.base}/courses/${course.id}/outline/generate`, (route) => route.fulfill(reply(job, 202)));
  await page.route(`${api.base}/jobs/${job.id}`, (route) =>
    route.fulfill(reply({ ...job, status: "failed", error: "La IA no respondió. Intenta de nuevo." })),
  );

  await page.goto(`/admin/courses/${course.id}/studio`);
  await page.getByLabel("¿Qué deben aprender?").fill("Cómo atender a un cliente molesto en la tienda, paso a paso.");
  await page.getByRole("button", { name: /Proponer estructura/ }).click();

  const failure = page.getByRole("heading", { name: "No se pudo proponer la estructura" });
  await expect(failure).toBeVisible({ timeout: 30_000 });
  await expect(failure).toBeFocused(); // it replaced the "working" panel, which had the focus
  await expect(page.getByRole("alert").filter({ hasText: "La IA no respondió. Intenta de nuevo." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Reintentar/ })).toBeEnabled();
  await page.getByRole("button", { name: /Volver al brief/ }).click();
  await expect(page.getByLabel("¿Qué deben aprender?")).toHaveValue(/cliente molesto/);
  await expect(page.getByRole("button", { name: /Proponer estructura/ })).toBeEnabled();
});
