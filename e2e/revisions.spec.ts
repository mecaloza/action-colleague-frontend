import { test, expect, type Locator, type Page, type Request } from "@playwright/test";
import { API, adminApi } from "./fixtures/api";
import { MODULE_TITLE, produceVideo, sceneTitles, scriptedCourse } from "./fixtures/scripts";

// "Pedir un cambio" to a module's script, against a backend with fake providers: the AI's change is deterministic
// (see fixtures/scripts.ts) and a video is really produced (fake voice, no presenter).
test.setTimeout(240_000);

const FIELD = "¿Qué quieres cambiar?";

/** The "Cambios al guion" panel. */
const sheetOf = (page: Page) => page.getByRole("dialog", { name: "Cambios al guion" });

/** The module's row in the course editor (the innermost item: the list holds them all). */
const rowOf = (page: Page) => page.getByRole("listitem").filter({ hasText: MODULE_TITLE }).last();

/** A scene of the open script in the studio (its own item: the module's item holds it too). */
const scene = (page: Page, number: number) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByLabel(`Diseño de la escena ${number}`, { exact: true }) })
    .last();

const isProposal = (moduleId: number) => (request: Request) =>
  request.url().endsWith(`/modules/${moduleId}/revisions`) && request.method() === "POST";
const isApply = (request: Request) => /\/revisions\/\d+\/apply$/.test(request.url()) && request.method() === "POST";

/** Asks for a change with this observation and waits for the AI's proposal; returns what was sent. */
async function askChange(page: Page, sheet: Locator, moduleId: number, observation: string) {
  await sheet.getByLabel(FIELD).fill(observation);
  const [asked] = await Promise.all([
    page.waitForRequest(isProposal(moduleId)),
    sheet.getByRole("button", { name: "Pedir propuesta" }).click(),
  ]);
  await expect(sheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeVisible({ timeout: 60_000 });
  return asked.postDataJSON();
}

test("un cambio a la escena 2 se revisa escena por escena, se aplica y se deshace", async ({ page, request }) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Cambios al guion");
  await produceVideo(call, courseId, moduleId);

  await page.goto(`/admin/courses/${courseId}`);
  const row = rowOf(page);
  await expect(row.getByRole("button", { name: `Editar ${MODULE_TITLE}` })).toBeVisible();
  await expect(row.getByText(/El video no refleja/)).toHaveCount(0); // the video shows the script as it is
  await row.getByRole("button", { name: `Pedir un cambio al guion de ${MODULE_TITLE}` }).click();

  // The form: the observation (with examples) and the scenes it is about.
  const sheet = sheetOf(page);
  const field = sheet.getByLabel(FIELD);
  await expect(field).toBeVisible();
  const whole = sheet.getByRole("button", { name: "Todo el guion" });
  await expect(whole).toHaveAttribute("aria-pressed", "true");
  const second = sheet.getByRole("button", { name: "Escena 02 · Reglas del casco" });
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(whole).toHaveAttribute("aria-pressed", "false");
  // Nothing written yet: said next to the field, which takes the focus.
  await sheet.getByRole("button", { name: "Pedir propuesta" }).click();
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(/Escribe qué quieres cambiar\./);
  // An example fills it in.
  await sheet.getByRole("button", { name: /Usar el ejemplo: El título no se entiende/ }).click();
  await expect(field).toHaveValue("El título no se entiende: que diga exactamente qué se revisa.");

  const observation = "El título no se entiende y la narración debe nombrar los dos puntos.";
  expect(await askChange(page, sheet, moduleId, observation)).toEqual({
    target: "script",
    observation,
    scene_ids: ["s2"],
  });
  await expect(sheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeFocused(); // the result arrived
  await expect(sheet).toContainText("Ajusté 1 escena(s) según la observación.");
  await expect(sheet).toContainText(`Pediste: «${observation}» · Escena 02`);

  // Scene 2, field by field: its title before and after, its narration word by word, and its slide drawn both ways.
  const card = sheet.getByRole("listitem", { name: "Escena 2: Revisado: Reglas del casco" });
  await expect(card.getByText("Cambia", { exact: true })).toBeVisible();
  await expect(card).toContainText("Por qué: Así lo pidió la observación.");
  await expect(card.getByText("Reglas del casco", { exact: true })).toBeVisible();
  await expect(card.getByText("Revisado: Reglas del casco", { exact: true })).toBeVisible();
  await expect(card.locator("ins")).toHaveText("[agregado: Revisa este punto con cuidado.]");
  await expect(card.locator("del")).toHaveCount(0);
  // The slides are drawn as they come into sight.
  await card.getByText("Después", { exact: true }).first().scrollIntoViewIfNeeded();
  await expect(card.getByRole("img", { name: "Escena 2 antes del cambio" })).toBeVisible({ timeout: 30_000 });
  await expect(card.getByRole("img", { name: "Escena 2 con el cambio" })).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByRole("listitem", { name: /^Escena [13]:/ })).toHaveCount(0); // only what changes
  // What producing the video again takes.
  const impact = sheet.getByRole("region", { name: "Para el video" });
  await expect(impact).toContainText(/Se vuelve a narrar 1 escena \(≈ \d+ caracteres\)\./);
  await expect(impact).toContainText("El video sigue como está hasta que lo vuelvas a producir.");

  // Applied (without producing the video): the panel closes and a toast offers to undo it.
  const [applied] = await Promise.all([
    page.waitForRequest(isApply),
    sheet.getByRole("button", { name: "Aplicar", exact: true }).click(),
  ]);
  expect(applied.postDataJSON()).toEqual({ render: false });
  await expect(sheet).toBeHidden();
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Cambio aplicado" });
  await expect(toast).toContainText("El video no lo refleja hasta que lo vuelvas a producir.");
  expect(await sceneTitles(call, moduleId)).toEqual(["Seguridad en planta", "Revisado: Reglas del casco", "Para recordar"]);
  // The video no longer shows the script as it is: the module says so, with a way to produce it again.
  await expect(row.getByText("El video no refleja 1 escena del guion")).toBeVisible();
  await expect(row.getByRole("button", { name: `Volver a producir el video de ${MODULE_TITLE}` })).toBeVisible();

  // Undone from the toast: scene 2 is back, and the video shows the script again.
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Cambio deshecho" })).toBeVisible();
  await expect(row.getByText(/El video no refleja/)).toHaveCount(0);
  expect(await sceneTitles(call, moduleId)).toEqual(["Seguridad en planta", "Reglas del casco", "Para recordar"]);

  // The history: the undo (which could be undone too), the change it undid, and the script saved at first.
  await row.getByRole("button", { name: `Pedir un cambio al guion de ${MODULE_TITLE}` }).click();
  await sheet.getByRole("tab", { name: "Historial" }).click();
  const history = sheet.getByRole("list", { name: "Cambios del guion" }).getByRole("listitem");
  await expect(history).toHaveCount(3);
  await expect(history.nth(0)).toContainText("Cambio deshecho");
  await expect(history.nth(0)).toContainText("Aplicado");
  await expect(history.nth(0).getByRole("button", { name: /^Deshacer: Deshace: / })).toBeVisible();
  await expect(history.nth(1)).toContainText("Cambio pedido a la IA");
  await expect(history.nth(1)).toContainText("Deshecho");
  await expect(history.nth(1)).toContainText(`«${observation}»`);
  await expect(history.nth(1).getByRole("button", { name: /Deshacer/ })).toHaveCount(0);
  await expect(history.nth(2)).toContainText("Edición a mano");
  await expect(history.nth(2)).toContainText("Cambios a mano en 3 escenas.");
});

test("una propuesta espera en el módulo hasta revisarla, y descartarla deja reformular el pedido", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Propuesta descartada");
  await page.goto(`/admin/courses/${courseId}/studio`);
  const steps = page.getByRole("navigation", { name: "Pasos del estudio" });
  await steps.getByRole("button", { name: /Contenido/ }).click();
  await page.getByRole("button", { name: /Revisar guion/ }).click();

  // The AI starts from the saved script: not while there are edits, at the top or on a scene.
  const sceneButton = scene(page, 2).getByRole("button", { name: "Pedir un cambio en la escena 2" });
  const scriptButton = page.getByRole("button", { name: "Pedir un cambio", exact: true });
  await scene(page, 1).getByLabel("Narración").fill("Bienvenida al módulo del casco.");
  await expect(sceneButton).toBeDisabled();
  await expect(scriptButton).toBeDisabled();
  await expect(scriptButton).toHaveAccessibleDescription(
    "Para pedirle un cambio a la IA, primero guarda o descarta lo que editaste: la IA trabaja sobre lo guardado.",
  );
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(sceneButton).toBeEnabled();

  // A scene's own button: the change starts on that scene.
  await sceneButton.click();
  const sheet = sheetOf(page);
  await expect(sheet.getByRole("button", { name: "Escena 02 · Reglas del casco" })).toHaveAttribute("aria-pressed", "true");
  const observation = "Más corto y directo.";
  expect(await askChange(page, sheet, moduleId, observation)).toMatchObject({ scene_ids: ["s2"] });

  // Left for later: the module says a change waits, and opening it shows the proposal again.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(sceneButton).toBeFocused(); // back where the admin was
  const waiting = page.getByRole("button", { name: `Cambio por revisar: abrir la propuesta de ${MODULE_TITLE}` });
  await waiting.click();
  await expect(sheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeVisible();
  await expect(sheet).toContainText(`Pediste: «${observation}» · Escena 02`);

  // Discarded: nothing changed, and the form is back with the observation to reword it.
  await sheet.getByRole("button", { name: "Descartar" }).click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Propuesta descartada" })).toBeVisible();
  await expect(sheet.getByLabel(FIELD)).toHaveValue(observation);
  await expect(sheet.getByRole("button", { name: "Escena 02 · Reglas del casco" })).toHaveAttribute("aria-pressed", "true");
  expect(await sceneTitles(call, moduleId)).toEqual(["Seguridad en planta", "Reglas del casco", "Para recordar"]);
  await sheet.getByRole("tab", { name: "Historial" }).click();
  await expect(sheet.getByRole("list", { name: "Cambios del guion" }).getByRole("listitem").first()).toContainText(
    "Descartado",
  );
  await page.keyboard.press("Escape");
  await expect(waiting).toHaveCount(0);
});

test("otro ajuste reemplaza la propuesta, y aplicarla puede volver a producir el video", async ({ page, request }) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Otro ajuste");
  await produceVideo(call, courseId, moduleId);
  // The module has its video: the studio opens on Producción.
  await page.goto(`/admin/courses/${courseId}/studio`);
  await expect(page.getByRole("heading", { name: "Tu curso está producido." })).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: MODULE_TITLE });
  await row.getByRole("button", { name: `Pedir un cambio al guion de ${MODULE_TITLE}` }).click();

  // The whole script: the AI picks the scene (with fake providers, the first one).
  const sheet = sheetOf(page);
  const first = "La portada debe sonar más cercana.";
  expect(await askChange(page, sheet, moduleId, first)).toMatchObject({ scene_ids: null });
  await expect(sheet).toContainText(`Pediste: «${first}» · Todo el guion`);
  await expect(sheet.getByRole("listitem", { name: "Escena 1: Revisado: Seguridad en planta" })).toBeVisible();

  // Another adjustment replaces it (the admin can go back to it before asking).
  await sheet.getByRole("button", { name: "Pedir otro ajuste" }).click();
  await expect(sheet).toContainText(`La propuesta anterior («${first}») se reemplaza por la que pidas ahora.`);
  await expect(sheet.getByLabel(FIELD)).toHaveValue("");
  await sheet.getByRole("button", { name: "Volver a la propuesta" }).click();
  await expect(sheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeFocused();
  await sheet.getByRole("button", { name: "Pedir otro ajuste" }).click();
  const second = "Que también cambie la lectura del módulo.";
  await askChange(page, sheet, moduleId, second);
  const reading = sheet.getByRole("listitem", { name: "Lectura del módulo" });
  await expect(reading).toContainText("El casco se usa siempre en la planta.");
  await expect(reading).toContainText("- Revisado.");

  // Applied and produced again in one step: no undo in the toast while the video is being made.
  const [applied] = await Promise.all([
    page.waitForResponse((response) => isApply(response.request())),
    sheet.getByRole("button", { name: "Aplicar y volver a producir" }).click(),
  ]);
  expect(applied.request().postDataJSON()).toEqual({ render: true });
  expect((await applied.json()).render_job).toMatchObject({ type: "video.render", module_id: moduleId });
  await expect(sheet).toBeHidden();
  const toast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Cambio aplicado. El video se está produciendo de nuevo." });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "Deshacer" })).toHaveCount(0);

  // The first proposal was replaced; the second one is applied (and can be undone from the history).
  await row.getByRole("button", { name: `Pedir un cambio al guion de ${MODULE_TITLE}` }).click();
  await sheet.getByRole("tab", { name: "Historial" }).click();
  const history = sheet.getByRole("list", { name: "Cambios del guion" }).getByRole("listitem");
  await expect(history).toHaveCount(3);
  await expect(history.nth(0)).toContainText(`«${second}»`);
  await expect(history.nth(0)).toContainText("Aplicado");
  await expect(history.nth(0).getByRole("button", { name: /^Deshacer/ })).toBeVisible();
  await expect(history.nth(1)).toContainText(`«${first}»`);
  await expect(history.nth(1)).toContainText("Reemplazado");
});

test("si la escena cambió desde la propuesta, no se aplica: se pide de nuevo", async ({ page, request }) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Propuesta vieja");
  await page.goto(`/admin/courses/${courseId}`);
  await rowOf(page).getByRole("button", { name: `Pedir un cambio al guion de ${MODULE_TITLE}` }).click();
  const sheet = sheetOf(page);
  await sheet.getByRole("button", { name: "Escena 02 · Reglas del casco" }).click();
  const observation = "El título no se entiende.";
  await askChange(page, sheet, moduleId, observation);
  // The module has no video: nothing to produce again.
  await expect(sheet.getByRole("region", { name: "Para el video" })).toContainText(
    "El módulo aún no tiene video: el cambio se verá cuando lo produzcas.",
  );
  await expect(sheet.getByRole("button", { name: "Aplicar y volver a producir" })).toHaveCount(0);

  // Meanwhile scene 2 is edited elsewhere.
  const edited = (await call<{ scenes: { id: string; slide: Record<string, unknown> }[] }>(
    "get",
    `/modules/${moduleId}/storyboard`,
  )).scenes;
  edited[1].slide.title = "Reglas del casco en planta";
  await call("put", `/modules/${moduleId}/storyboard`, { scenes: edited });

  await sheet.getByRole("button", { name: "Aplicar", exact: true }).click();
  const stale = sheet.getByRole("alert").filter({ hasText: "El guion cambió desde la propuesta" });
  await expect(stale).toContainText("El guion cambió en la escena 2 desde la propuesta; pide el cambio de nuevo.");
  await expect(sheet.getByRole("button", { name: "Aplicar", exact: true })).toBeDisabled();
  expect(await sceneTitles(call, moduleId)).toEqual(["Seguridad en planta", "Reglas del casco en planta", "Para recordar"]);

  // Asked again from the script as it is now: the same observation and scene, replacing the old proposal.
  await stale.getByRole("button", { name: "Pedir el cambio de nuevo" }).click();
  await expect(sheet.getByLabel(FIELD)).toHaveValue(observation);
  await expect(sheet.getByRole("button", { name: "Escena 02 · Reglas del casco en planta" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await askChange(page, sheet, moduleId, observation);
  await sheet.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(sheet).toBeHidden();
  expect(await sceneTitles(call, moduleId)).toEqual([
    "Seguridad en planta",
    "Revisado: Reglas del casco en planta",
    "Para recordar",
  ]);
});

test("si la IA no puede proponer el cambio, lo dice y deja pedirlo de nuevo", async ({ page, request }) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Propuesta fallida");
  // The AI answers nothing that can be applied (simulated: the fake one always proposes something).
  const reason = "La IA no propuso cambios: esa escena ya dice exactamente eso.";
  await page.route(new RegExp(`${API}/revisions/\\d+$`), async (route) => {
    const response = await route.fetch();
    const revision = await response.json();
    if (revision.status !== "proposed") return route.fulfill({ response });
    await route.fulfill({ response, json: { ...revision, status: "failed", changes: null, error: reason } });
  });
  await page.goto(`/admin/courses/${courseId}`);
  await rowOf(page).getByRole("button", { name: `Pedir un cambio al guion de ${MODULE_TITLE}` }).click();
  const sheet = sheetOf(page);
  await sheet.getByLabel(FIELD).fill("Revisa la escena 2.");
  await sheet.getByRole("button", { name: "Pedir propuesta" }).click();
  const failed = sheet.getByRole("heading", { name: "No se pudo preparar la propuesta" });
  await expect(failed).toBeVisible({ timeout: 60_000 });
  await expect(failed).toBeFocused();
  await expect(sheet).toContainText(reason);
  await sheet.getByRole("button", { name: "Pedir de nuevo" }).click();
  await expect(sheet.getByLabel(FIELD)).toHaveValue("Revisa la escena 2.");
  await expect(sheet.getByLabel(FIELD)).toBeFocused();
  expect(await sceneTitles(call, moduleId)).toEqual(["Seguridad en planta", "Reglas del casco", "Para recordar"]);
});
