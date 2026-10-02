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
  // The AI picked an icon for each point; the admin can change it from the picker.
  const firstPointIcon = page.getByRole("button", { name: /^Ícono de Viñetas 1:/ }).first();
  await expect(firstPointIcon).toHaveAccessibleName("Ícono de Viñetas 1: Idea");
  await firstPointIcon.click();
  await expect(page.getByRole("menuitemradio", { name: "Idea" })).toBeFocused(); // opens on the icon in use
  await page.getByRole("menuitemradio", { name: "Casco" }).click();
  await expect(firstPointIcon).toHaveAccessibleName("Ícono de Viñetas 1: Casco");
  // Removing a point takes its icon with it: the next point moves up with its own.
  await page.getByRole("button", { name: "Quitar: Primera idea clave" }).click();
  await expect(page.getByRole("textbox", { name: "Viñetas 1", exact: true }).first()).toHaveValue("Segunda idea clave");
  await expect(firstPointIcon).toHaveAccessibleName("Ícono de Viñetas 1: Objetivo");
  await expect(page.getByRole("button", { name: /^Ícono de Viñetas 3:/ })).toHaveCount(0);
  // The AI chose what fills each scene's background; the admin can change it.
  // The scene's own item (the innermost one: the module's item holds it too).
  const scene = (number: number) =>
    page
      .getByRole("listitem")
      .filter({ has: page.getByLabel(`Diseño de la escena ${number}`, { exact: true }) })
      .last();
  const secondScene = scene(2);
  const secondVisual = secondScene.getByLabel("Visual de fondo");
  await expect(secondVisual).toHaveValue("none"); // teaching scenes carry no decorative background by default
  await secondVisual.selectOption("image");
  await secondScene.getByLabel("Qué debe mostrar (en inglés)").fill("");
  await expect(secondScene.getByText(/sin eso la escena sale sin visual/)).toBeVisible();
  await secondScene.getByLabel("Qué debe mostrar (en inglés)").fill("Cutaway of a truck tire showing its steel belts");
  // An infographic scene: its picture is its content, described in Spanish, with a new version on request.
  const infographic = scene(3);
  await expect(infographic.getByLabel("Diseño de la escena 3")).toHaveValue("visual");
  await expect(infographic.getByLabel("Qué explica la infografía")).toHaveValue(/Presión y desgaste/);
  await expect(infographic.getByLabel("Visual de fondo")).toHaveCount(0);
  await infographic.getByRole("button", { name: "Otra versión" }).click();
  await expect(infographic.getByText("Versión 2")).toBeVisible();
  // Switching its layout away and back keeps the description.
  await infographic.getByLabel("Diseño de la escena 3").selectOption("bullets");
  await expect(infographic.getByLabel("Qué explica la infografía")).toHaveCount(0);
  await infographic.getByLabel("Diseño de la escena 3").selectOption("visual");
  await expect(infographic.getByLabel("Qué explica la infografía")).toHaveValue(/Presión y desgaste/);
  // A practical case in its four parts.
  const practicalCase = scene(4);
  await expect(practicalCase.getByLabel("Situación")).toHaveValue("Situación de la flota");
  await expect(practicalCase.getByLabel("Resultado")).toHaveValue("Lo que mejoró");
  // A comparison turned into a chart with exact figures.
  const chart = scene(5);
  await chart.getByLabel("Diseño de la escena 5").selectOption("chart");
  await chart.getByRole("button", { name: "Agregar barra" }).click();
  await chart.getByLabel("Barra 1: qué mide").fill("Presión correcta");
  await chart.getByLabel("Barra 1: valor").fill("80000");
  await chart.getByRole("button", { name: "Agregar barra" }).click();
  await chart.getByLabel("Barra 2: qué mide").fill("20 % baja");
  await chart.getByLabel("Barra 2: valor").fill("");
  await expect(chart.getByLabel("Barra 2: valor")).toHaveAttribute("aria-invalid", "true"); // not a figure yet
  await chart.getByLabel("Barra 2: valor").fill("1e13");
  await expect(chart.getByLabel("Barra 2: valor")).toHaveAttribute("aria-invalid", "true"); // past the limit
  await chart.getByLabel("Barra 1: valor").fill("80,000"); // Mexican thousands
  await chart.getByLabel("Barra 2: valor").fill("60000,5");
  await expect(chart.getByLabel("Barra 2: valor")).toHaveAttribute("aria-invalid", "false");
  await chart.getByLabel("Unidad").fill("km");
  const rewrite = page.getByLabel("¿Prefieres que la IA lo reescriba?");
  await rewrite.fill("Más ejemplos de la planta");
  // After saving, the infographic's preview is asked again (the server is drawing the new version).
  const infographicPreview = page.waitForRequest(
    (request) => request.url().endsWith("/slides/preview") && request.postDataJSON()?.visual?.variant === 1,
  );
  const scenes = page.getByRole("list", { name: /^Escenas de/ });
  await scenes.evaluate((list) => list.setAttribute("data-before-save", ""));
  const [saved] = await Promise.all([
    page.waitForRequest((request) => request.url().endsWith("/storyboard") && request.method() === "PUT"),
    page.getByRole("button", { name: /Guardar guion/ }).click(),
  ]);
  const savedScenes = saved.postDataJSON().scenes;
  expect(savedScenes[2].visual).toMatchObject({ kind: "infographic", variant: 1 });
  expect(savedScenes[4].slide).toMatchObject({
    layout: "chart",
    chart_labels: ["Presión correcta", "20 % baja"],
    chart_values: [80000, 60000.5],
    chart_unit: "km",
  });
  await expect(page.getByText("Guion guardado")).toBeVisible();
  await scene(3).getByLabel("Qué explica la infografía").scrollIntoViewIfNeeded();
  await infographicPreview;
  await expect(scenes).toHaveAttribute("data-before-save", ""); // the same form: not remounted with the saved copy
  await expect(page.getByRole("button", { name: "Descartar cambios" })).toBeHidden(); // the form has the saved copy
  await expect(rewrite).toHaveValue("Más ejemplos de la planta"); // and it kept the instructions for a rewrite
  await page.getByRole("button", { name: /Elegir voz y estilo/ }).click();

  // 04 Style and voice
  await page.getByRole("button", { name: /Voz de prueba/ }).click();
  await page.getByRole("button", { name: /Presentadora de prueba/ }).click();
  // A second presenter (the company's own avatar, listed apart) takes turns with its own voice.
  await page.getByRole("switch", { name: "Agregar un segundo presentador" }).click();
  const second = page.getByRole("region", { name: "Segundo presentador" });
  await expect(second.getByRole("group", { name: "De tu empresa" })).toBeVisible();
  await expect(second.getByRole("button", { name: /Presentadora de prueba/ })).toHaveCount(0); // already the first
  await second.getByRole("button", { name: /Directivo de prueba/ }).click();
  await expect(page.getByRole("button", { name: /Producir 2 videos/ })).toBeDisabled(); // its voice is missing
  await second.getByRole("button", { name: /Voz de prueba/ }).click();
  // A presenter that only exists in Standard can't stay chosen in Premium.
  await page
    .getByRole("button", { name: /Presentador básico/ })
    .first()
    .click();
  await page.getByRole("button", { name: /^Premium/ }).click();
  await expect(page.getByRole("button", { name: /Presentador básico/ }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: /Producir 2 videos/ })).toBeDisabled(); // the first presenter was cleared
  await page
    .getByRole("button", { name: /Presentadora de prueba/ })
    .first()
    .click();
  await page.getByRole("button", { name: /^Alta/ }).click();
  await page.getByRole("button", { name: "Claro" }).click();
  const [render] = await Promise.all([
    page.waitForRequest((request) => request.url().endsWith("/render") && request.method() === "POST"),
    page.getByRole("button", { name: /Producir 2 videos/ }).click(),
  ]);
  expect(render.postDataJSON()).toMatchObject({
    avatar_id: "fake-avatar",
    co_avatar_id: "fake-avatar-2",
    co_voice_id: "fake-voice-es",
    avatar_engine: "avatar_iv",
    animation: "high",
  });

  // 05 Production
  await expect(page.getByRole("heading", { name: "Tu curso está producido." })).toBeVisible({ timeout: 180_000 });
  await page
    .getByRole("button", { name: /Ver el video de/ })
    .first()
    .click();
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
  await expect(scriptedRow).toContainText("La última operación falló. El servicio de voz no respondió.");
  await expect(scriptedRow.getByRole("button", { name: "Reintentar", exact: true })).toHaveCount(0);

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
  const failed = { ...job, status: "failed", error: "La IA no respondió. Intenta de nuevo." };
  const asked: { modules?: number | null }[] = [];
  await page.route(`${api.base}/courses/${course.id}/outline/generate`, (route) => {
    asked.push(route.request().postDataJSON());
    return route.fulfill(reply(job, 202));
  });
  await page.route(`${api.base}/jobs/${job.id}`, (route) => route.fulfill(reply(failed)));

  await page.goto(`/admin/courses/${course.id}/studio`);
  await page.getByLabel("¿Qué deben aprender?").fill("Cómo atender a un cliente molesto en la tienda, paso a paso.");
  const threeModules = page.getByRole("group", { name: "Módulos" }).getByRole("button", { name: "3", exact: true });
  await threeModules.click();
  await page.getByRole("button", { name: /Proponer estructura/ }).click();

  const failure = page.getByRole("heading", { name: "No se pudo proponer la estructura" });
  await expect(failure).toBeVisible({ timeout: 30_000 });
  await expect(failure).toBeFocused(); // it replaced the "working" panel, which had the focus
  await expect(page.getByRole("alert").filter({ hasText: "La IA no respondió. Intenta de nuevo." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Reintentar/ })).toBeEnabled();

  // After a reload the step still shows why (the course's newest proposal failed)...
  await page.route(
    (url) => url.pathname.endsWith("/api/v1/jobs") && url.searchParams.get("course_id") === String(course.id),
    (route) => route.fulfill(reply(new URL(route.request().url()).searchParams.has("active") ? [] : [failed])),
  );
  await page.reload();
  await expect(failure).toBeVisible({ timeout: 30_000 });
  // ...and retrying, now from the brief saved with the course, asks for the same number of modules.
  await page.getByRole("button", { name: /Reintentar/ }).click();
  await expect.poll(() => asked.length).toBe(2);
  await expect(failure).toBeVisible({ timeout: 30_000 });
  expect(asked.map((body) => body.modules)).toEqual([3, 3]);
  await page.getByRole("button", { name: /Volver al brief/ }).click();
  await expect(page.getByLabel("¿Qué deben aprender?")).toHaveValue(/cliente molesto/);
  await expect(threeModules).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Proponer estructura/ })).toBeEnabled();
});

/** A course whose proposal is running when the studio opens (asked elsewhere); `finish` ends it. */
async function courseWithRunningProposal(page: Page) {
  const api = await adminApi(page);
  const course = await api.call<{ id: number }>("POST", "/courses", {
    title: `Propuesta en curso ${Date.now()}`,
    source: "ai",
  });
  await api.call("PATCH", `/courses/${course.id}`, {
    settings: { brief: "Brief guardado: atender a un cliente molesto en la tienda, paso a paso.", modules: 3 },
  });
  const job = {
    id: `e2e-running-${course.id}`,
    type: "ai.outline",
    status: "running",
    progress: 30,
    step: "Leyendo tus materiales",
    error: null as string | null,
    course_id: course.id,
    module_id: null,
    result: null,
    created_at: null,
    updated_at: null,
  };
  let ended: typeof job | null = null;
  const reply = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
  await page.route(`${api.base}/jobs/${job.id}`, (route) => route.fulfill(reply(ended ?? job)));
  await page.route(
    (url) => url.pathname.endsWith("/api/v1/jobs") && url.searchParams.get("course_id") === String(course.id),
    async (route) => {
      const active = new URL(route.request().url()).searchParams.has("active");
      if (!active) await new Promise((resolve) => setTimeout(resolve, 1500)); // a slow network makes any wait visible
      return route.fulfill(reply(active ? (ended ? [] : [job]) : [ended ?? job]));
    },
  );
  let proposed = false;
  await page.route(
    (url) => url.pathname.endsWith(`/api/v1/courses/${course.id}/outline`),
    (route) =>
      proposed
        ? route.fulfill(
            reply({
              title: "Atención al cliente",
              description: "D",
              audience: "A",
              objectives: ["O"],
              modules: [
                {
                  title: "M1",
                  summary: "S",
                  objectives: ["o"],
                  key_points: ["k"],
                  estimated_minutes: 5,
                  include_quiz: true,
                },
              ],
            }),
          )
        : route.fulfill(reply({ detail: "No hay propuesta" }, 404)),
  );
  // The studio's title is never replaced by the page's loading state.
  const watchStudio = async () => {
    await page.evaluate(() => {
      const w = window as unknown as { studioBlanked: boolean };
      w.studioBlanked = false;
      const title = document.querySelector("h1");
      new MutationObserver(() => {
        if (title && !document.body.contains(title)) w.studioBlanked = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
    return () => page.evaluate(() => (window as unknown as { studioBlanked: boolean }).studioBlanked);
  };
  const finish = (status: "failed" | "succeeded") => {
    proposed = status === "succeeded";
    ended = { ...job, status, progress: 100, error: status === "failed" ? "La IA no respondió." : null };
  };
  return { course, watchStudio, finish };
}

test("cuando termina una propuesta pedida en otra visita, el estudio sigue en pantalla con lo que se estaba escribiendo", async ({
  page,
}) => {
  const { course, watchStudio, finish } = await courseWithRunningProposal(page);
  await page.goto(`/admin/courses/${course.id}/studio`);
  await expect(page.getByRole("heading", { name: "La IA está armando tu curso" })).toBeVisible();
  await page.getByRole("navigation", { name: "Pasos del estudio" }).getByRole("button", { name: /Brief/ }).click();
  const brief = page.getByLabel("¿Qué deben aprender?");
  await expect(brief).toHaveValue(/Brief guardado/);
  await brief.fill("Texto nuevo que el admin todavía no envía a la IA.");
  const blanked = await watchStudio();

  finish("failed");
  await page
    .getByRole("navigation", { name: "Pasos del estudio" })
    .getByRole("button", { name: /Estructura/ })
    .click();
  await page.getByRole("button", { name: "Descartar" }).click(); // leaving the brief with unsent text asks first
  await expect(page.getByRole("heading", { name: "No se pudo proponer la estructura" })).toBeVisible({
    timeout: 15_000,
  });
  expect(await blanked()).toBe(false);
});

test("cuando termina bien una propuesta pedida en otra visita, el foco llega a la estructura propuesta", async ({
  page,
}) => {
  const { course, watchStudio, finish } = await courseWithRunningProposal(page);
  await page.goto(`/admin/courses/${course.id}/studio`);
  await expect(page.getByRole("heading", { name: "La IA está armando tu curso" })).toBeVisible();
  const blanked = await watchStudio();

  finish("succeeded");
  await expect(page.getByLabel("Título del curso")).toHaveValue("Atención al cliente", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Estructura propuesta" })).toBeFocused();
  expect(await blanked()).toBe(false);
});
