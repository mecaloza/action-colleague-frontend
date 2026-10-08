import { test, expect, type APIRequestContext, type Page, type Request } from "@playwright/test";
import { API, adminApi } from "./fixtures/api";

// Runs against a backend with fake providers: the slides are checked with the renderer the videos use.
test.setTimeout(120_000);

/** The longest point a slide accepts: not even its smallest size fits it on a bullets slide. */
const LONG_POINT = "Usar siempre el equipo de protección personal completo antes de entrar a la zona de producción "
  .repeat(4)
  .slice(0, 300);
const TOO_LONG = "La viñeta 2 no cabe y se corta. Usa un texto más corto.";
/** One word wider than a line of the slide: it is split in two. */
const URL_POINT = "https://intranet.empresa.com/seguridad/procedimientos/uso-obligatorio-del-casco-en-planta";
const COVERED = "El presentador tapa parte de la infografía. Usa «Otra versión» de la infografía.";
const NEW_VERSION = "La nueva versión se dibuja al guardar el guion y se revisa cuando esté lista.";
const UNDER_PRESENTER = "Un elemento de la diapositiva queda debajo del presentador.";
const NOT_CHECKED = "No se pudo revisar si los textos caben en las diapositivas.";

const COVER = {
  id: "s1",
  slide: { layout: "cover", title: "Seguridad en planta", subtitle: "Lo esencial" },
  narration: "Bienvenida al módulo sobre el uso correcto del casco en la planta.",
};
const RULES = {
  id: "s2",
  slide: { layout: "bullets", title: "Reglas del casco", points: ["Siempre puesto", LONG_POINT] },
  narration: "Hay dos reglas: llevarlo siempre puesto y revisarlo antes de cada turno.",
};
const FIGURE = {
  id: "s3",
  slide: { layout: "stat", stat_value: "87 %", stat_label: "de los golpes en la cabeza se evitan con el casco" },
  narration: "Casi nueve de cada diez golpes en la cabeza se evitan con el casco.",
};
const INFOGRAPHIC = {
  id: "s4",
  slide: { layout: "visual", title: "Presión y desgaste" },
  narration: "Mira las tres huellas de la infografía: baja, correcta y alta presión.",
  visual: { kind: "infographic", query: "", prompt: "Infografía: «Presión y desgaste». Tres huellas de llanta." },
};

/** A video made before (it never loads here: only its presence matters). */
const VIDEO = { url: "https://example.com/video.mp4", mime_type: "video/mp4", duration_seconds: 60, width: 1280, height: 720 };

/** An AI course with one module whose script (saved through the API) has these scenes. */
async function scriptedCourse(request: APIRequestContext, scenes: object[]) {
  const call = await adminApi(request);
  const course = await call<{ id: number }>("post", "/courses", { title: `Avisos de diseño ${Date.now()}`, source: "ai" });
  const module = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: "Uso del casco",
    source: "ai",
  });
  await call("put", `/modules/${module.id}/storyboard`, { scenes });
  return { courseId: course.id, moduleId: module.id };
}

/** The scene's own item (the innermost one: the module's item holds it too). */
const scene = (page: Page, number: number) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByLabel(`Diseño de la escena ${number}`, { exact: true }) })
    .last();

/** The module's draft checks fail (500) while `failing()` says so. */
async function failChecks(page: Page, moduleId: number, failing: () => boolean) {
  await page.route(`${API}/modules/${moduleId}/storyboard/lint`, (route) => {
    if (!failing()) return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ detail: "Internal Server Error" }),
    });
  });
}

/** The studio opens on Producción: the course's modules have their video (simulated: it never loads here). */
async function producedCourse(page: Page, courseId: number) {
  await page.route(`${API}/courses/${courseId}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const detail = await response.json();
    for (const each of detail.modules) Object.assign(each, { video: VIDEO, duration_seconds: 60 });
    await route.fulfill({ response, json: detail });
  });
  await page.goto(`/admin/courses/${courseId}/studio`);
  await expect(page.getByRole("heading", { name: "Tu curso está producido." })).toBeVisible();
}

/** The module's script open in the Contenido step (every script is written, so the studio opens on Estilo). */
async function openScript(page: Page, courseId: number) {
  await page.goto(`/admin/courses/${courseId}/studio`);
  await page.getByRole("navigation", { name: "Pasos del estudio" }).getByRole("button", { name: /Contenido/ }).click();
  await page.getByRole("button", { name: /Revisar guion/ }).click();
  await expect(scene(page, 1)).toBeVisible();
}

test("el guion avisa lo que no cabe en una diapositiva y deja de avisarlo al corregirlo", async ({ page, request }) => {
  const { courseId, moduleId } = await scriptedCourse(request, [COVER, RULES, FIGURE]);
  const checks: { scenes: { slide: { points: string[]; stat_value: string }; narration?: string }[] }[] = [];
  const isCheck = (request: Request) =>
    request.url().endsWith(`/modules/${moduleId}/storyboard/lint`) && request.method() === "POST";
  page.on("request", (request) => {
    if (isCheck(request)) checks.push(request.postDataJSON());
  });
  // A clock the test can move forward: the pause after which a draft is checked can go by at once.
  await page.clock.install();
  await openScript(page, courseId);

  // The saved script comes with its warnings: above the scenes, on the scene and next to the point that causes it.
  const summary = page.getByRole("region", { name: "Avisos de diseño" });
  await expect(summary).toContainText("1 escena con un texto que no cabe");
  const rules = scene(page, 2);
  await expect(rules.getByText("1 aviso de diseño")).toBeVisible();
  await expect(scene(page, 1).getByText(/avisos? de diseño/)).toHaveCount(0);
  const longPoint = rules.getByRole("textbox", { name: "Viñetas 2", exact: true });
  await expect(longPoint).toHaveAttribute("aria-invalid", "true");
  await expect(longPoint).toHaveAccessibleDescription(TOO_LONG);
  await expect(rules.getByText(TOO_LONG)).toBeVisible();

  // From the summary to the point.
  await summary.getByRole("button", { name: "Escena 02" }).click();
  await expect(longPoint).toBeFocused();

  // Shortened, the draft is checked (not saved) after a pause in the typing, and the warning goes away.
  expect(checks).toHaveLength(0); // the saved script came with its own
  await longPoint.fill("Revisarlo antes de cada turno");
  await expect(rules.getByText(TOO_LONG)).toBeHidden();
  expect(checks).toHaveLength(1);
  expect(checks[0].scenes[1].slide.points[1]).toBe("Revisarlo antes de cada turno");
  expect(checks[0].scenes[1]).not.toHaveProperty("narration"); // only what the slides draw is checked
  await expect(longPoint).not.toHaveAttribute("aria-invalid", "true");
  await expect(rules.getByText("1 aviso de diseño")).toBeHidden();
  await expect(summary).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Sin avisos de diseño en las diapositivas." })).toBeAttached();
  // Writing the narration changes no slide: nothing is checked, not even once the pause has gone by; the next check
  // is the next slide change's.
  await rules.getByLabel("Narración").fill("Dos reglas: llevarlo siempre puesto y revisarlo antes de cada turno.");
  await page.clock.fastForward(2_000);
  const figure = scene(page, 3).getByLabel("Dato (número o cifra corta)");
  const [figureCheck] = await Promise.all([
    page.waitForRequest(isCheck),
    figure.fill("Treinta y cinco por ciento menos"),
  ]);
  expect(checks).toHaveLength(2);
  expect(figureCheck.postDataJSON().scenes[2].slide.stat_value).toBe("Treinta y cinco por ciento menos");

  // What the draft breaks is said as it is typed: a figure too long for its slide (an error) and a word split in
  // two (only a warning: the field isn't marked invalid).
  await expect(figure).toHaveAccessibleDescription("El dato no cabe y se corta. Usa un texto más corto.");
  await expect(figure).toHaveAttribute("aria-invalid", "true");
  const firstPoint = rules.getByRole("textbox", { name: "Viñetas 1", exact: true });
  await firstPoint.fill(URL_POINT);
  await expect(firstPoint).toHaveAccessibleDescription(
    "La viñeta 1 tiene una palabra que no cabe en una línea y se parte.",
  );
  await expect(firstPoint).not.toHaveAttribute("aria-invalid", "true");
  await expect(summary).toContainText("1 escena con un texto que no cabe");
  await expect(summary).toContainText("1 escena con una palabra partida");
  await expect(summary.getByRole("button", { name: /^Escena \d+$/ })).toHaveText(["Escena 02", "Escena 03"]);

  // Discarding the changes brings back the saved script, with its warnings.
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(longPoint).toHaveAccessibleDescription(TOO_LONG);
  await expect(summary).toContainText("1 escena con un texto que no cabe");
  await expect(summary).not.toContainText("palabra partida");

  // Fixed and saved: the server's copy has no warnings left.
  await longPoint.fill("Revisarlo antes de cada turno");
  const [saved] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith(`/modules/${moduleId}/storyboard`) && response.request().method() === "PUT",
    ),
    page.getByRole("button", { name: /Guardar guion/ }).click(),
  ]);
  expect((await saved.json()).warnings).toEqual([]);
  await expect(page.getByText("Guion guardado")).toBeVisible();
  await expect(summary).toBeHidden();
  await expect(rules.getByText(TOO_LONG)).toBeHidden();
});

test("si no se puede revisar el borrador, lo dice, deja lo último que encontró y se reintenta", async ({
  page,
  request,
}) => {
  const { courseId, moduleId } = await scriptedCourse(request, [COVER, RULES]);
  let failing = true; // until the retry
  await failChecks(page, moduleId, () => failing);
  await openScript(page, courseId);

  const longPoint = scene(page, 2).getByRole("textbox", { name: "Viñetas 2", exact: true });
  await longPoint.fill("Revisarlo antes de cada turno");
  const failed = page.getByText(NOT_CHECKED);
  await expect(failed).toBeVisible();
  // Read aloud as well: what was read before (the warnings found) no longer holds for the draft.
  await expect(failed).toHaveRole("status");
  await expect(longPoint).toHaveAccessibleDescription(TOO_LONG); // the last warnings found stay

  failing = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(failed).toBeHidden();
  await expect(longPoint).toHaveAccessibleDescription("");
  await expect(page.getByRole("region", { name: "Avisos de diseño" })).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Sin avisos de diseño en las diapositivas." })).toBeAttached();
});

test("al quitar una viñeta, sus avisos no pasan a la que toma su lugar", async ({ page, request }) => {
  const points = ["Siempre puesto", LONG_POINT, "Revisarlo antes de cada turno"];
  const { courseId, moduleId } = await scriptedCourse(request, [COVER, { ...RULES, slide: { ...RULES.slide, points } }]);
  let failing = true; // the draft can't be checked until the retry: the saved copy's warnings stay on screen
  await failChecks(page, moduleId, () => failing);
  await openScript(page, courseId);
  const rules = scene(page, 2);
  const point = (number: number) => rules.getByRole("textbox", { name: `Viñetas ${number}`, exact: true });
  await expect(point(2)).toHaveAccessibleDescription(TOO_LONG);

  // Without the first point, the long one is the first and the third one the second: the warning about "the point
  // 2" stays with the scene as a whole, not with the point that took its place.
  await rules.getByRole("button", { name: "Quitar: Siempre puesto" }).click();
  await expect(page.getByText(NOT_CHECKED)).toBeVisible();
  await expect(point(2)).toHaveValue("Revisarlo antes de cada turno");
  await expect(point(2)).toHaveAccessibleDescription("");
  await expect(point(2)).not.toHaveAttribute("aria-invalid", "true");
  await expect(rules.getByText(TOO_LONG)).toBeVisible();
  await expect(rules.getByText("1 aviso de diseño")).toBeVisible();

  // Checked at last: the warning is the first point's, next to it.
  failing = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(point(1)).toHaveAccessibleDescription("La viñeta 1 no cabe y se corta. Usa un texto más corto.");
  await expect(point(1)).toHaveAttribute("aria-invalid", "true");
  await expect(rules.getByText(TOO_LONG)).toBeHidden();
});

test("lo que no causa ningún campo se dice del diseño de la escena, y el resumen lleva allí", async ({
  page,
  request,
}) => {
  const { courseId, moduleId } = await scriptedCourse(request, [COVER, RULES]);
  // A line of the layout under the presenter (no field causes it) is simulated: the slides used here keep clear.
  await page.route(`${API}/modules/${moduleId}/storyboard`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const storyboard = await response.json();
    const underPresenter = ["s1", "s2"].map((sceneId) => ({
      scene_id: sceneId,
      code: "presenter_overlap",
      severity: "error",
      field: null,
      message: UNDER_PRESENTER,
    }));
    storyboard.warnings = [...(storyboard.warnings ?? []), ...underPresenter];
    await route.fulfill({ response, json: storyboard });
  });
  await openScript(page, courseId);

  const summary = page.getByRole("region", { name: "Avisos de diseño" });
  await expect(summary).toContainText("2 escenas con elementos encimados");
  const coverLayout = page.getByLabel("Diseño de la escena 1", { exact: true });
  await expect(coverLayout).toHaveAccessibleDescription(UNDER_PRESENTER);
  await expect(coverLayout).not.toHaveAttribute("aria-invalid", "true"); // the layout itself is fine
  await summary.getByRole("button", { name: "Escena 01" }).click();
  await expect(coverLayout).toBeFocused();

  // A scene with a field that causes one too: the summary takes the admin to that field first.
  await expect(page.getByLabel("Diseño de la escena 2", { exact: true })).toHaveAccessibleDescription(UNDER_PRESENTER);
  await summary.getByRole("button", { name: "Escena 02" }).click();
  await expect(scene(page, 2).getByRole("textbox", { name: "Viñetas 2", exact: true })).toBeFocused();
});

test("una infografía que tapa el presentador ofrece «Otra versión» y revisa la nueva cuando está dibujada", async ({
  page,
  request,
}) => {
  const { courseId, moduleId } = await scriptedCourse(request, [COVER, INFOGRAPHIC]);
  // The fake image model draws at once and keeps the presenter's corner empty. Simulated: the presenter covers every
  // version once it is drawn (the first one already is), and drawing the second one takes a while after the save
  // (the first time its preview is asked for then, it is still being drawn).
  let saved = false;
  let drawing = false;
  let secondDrawn = false;
  const covered = (scenes: { id: string; visual?: { variant?: number } }[]) =>
    scenes.some((each) => each.id === "s4" && (!each.visual?.variant || secondDrawn))
      ? [{ scene_id: "s4", code: "visual_under_presenter", severity: "warning", field: "visual", message: COVERED }]
      : [];
  await page.route(`${API}/modules/${moduleId}/storyboard`, async (route) => {
    const response = await route.fetch();
    const storyboard = await response.json();
    storyboard.warnings = [...(storyboard.warnings ?? []), ...covered(storyboard.scenes)];
    saved ||= route.request().method() === "PUT";
    await route.fulfill({ response, json: storyboard });
  });
  await page.route(`${API}/modules/${moduleId}/storyboard/lint`, async (route) => {
    const response = await route.fetch();
    const lint = await response.json();
    lint.warnings = [...lint.warnings, ...covered(route.request().postDataJSON().scenes)];
    await route.fulfill({ response, json: lint });
  });
  await page.route(`${API}/slides/preview`, async (route) => {
    const response = await route.fetch();
    if (!saved || route.request().postDataJSON().visual?.variant !== 1) return route.fulfill({ response });
    if (!drawing) {
      drawing = true;
      return route.fulfill({ response, headers: { ...response.headers(), "x-visual-pending": "1" } });
    }
    secondDrawn = response.headers()["x-visual-pending"] !== "1";
    return route.fulfill({ response });
  });
  await openScript(page, courseId);

  const infographic = scene(page, 2);
  const summary = page.getByRole("region", { name: "Avisos de diseño" });
  await expect(summary).toContainText("1 escena con la infografía tapada por el presentador");
  await expect(infographic.getByText("1 aviso de diseño")).toBeVisible();
  const otherVersion = infographic.getByRole("button", { name: "Otra versión" });
  await expect(otherVersion).toHaveAccessibleDescription(COVERED);

  // The fix is right there. The new version is drawn when the script is saved: until it is checked, it isn't taken
  // as fixed (a note, read aloud, instead of the warning).
  await otherVersion.click();
  await expect(infographic.getByText("Versión 2")).toBeVisible();
  await expect(otherVersion).toBeFocused(); // the same button: the focus stays on it
  await expect(otherVersion).toHaveAccessibleDescription(NEW_VERSION);
  await expect(infographic.getByRole("status").filter({ hasText: NEW_VERSION })).toBeVisible();
  await expect(infographic.getByText(COVERED)).toBeHidden();
  await expect(summary).toBeHidden();

  // Saved: it is being drawn, still unchecked. Once drawn it is checked, and the presenter covers this one too.
  await page.getByRole("button", { name: /Guardar guion/ }).click();
  await expect(page.getByText("Guion guardado")).toBeVisible();
  await expect(infographic.getByText("La imagen de la escena se está dibujando; aparece aquí al terminar.")).toBeVisible();
  await expect(otherVersion).toHaveAccessibleDescription(NEW_VERSION);
  await expect(otherVersion).toHaveAccessibleDescription(COVERED, { timeout: 30_000 }); // the preview asks every 8 s
  await expect(infographic.getByText(NEW_VERSION)).toBeHidden();
  await expect(summary).toContainText("1 escena con la infografía tapada por el presentador");
});

test("producción muestra los avisos del guion de cada módulo y lleva a corregirlos", async ({ page, request }) => {
  const { courseId } = await scriptedCourse(request, [COVER, RULES]);
  await producedCourse(page, courseId);

  const row = page.getByRole("listitem").filter({ hasText: "Uso del casco" });
  await expect(row).toContainText("Avisos de diseño: 1 escena con un texto que no cabe.");
  const details = row.getByRole("button", { name: "Ver avisos" });
  await details.click();
  await expect(row.getByRole("button", { name: "Ocultar avisos" })).toHaveAttribute("aria-expanded", "true");
  await expect(row.getByRole("listitem").filter({ hasText: TOO_LONG })).toHaveText(`Escena 02: ${TOO_LONG}`);

  // To the script, open on that module, with the warning next to the point.
  await row.getByRole("button", { name: /Corregir en el guion/ }).click();
  await expect(page.getByRole("heading", { name: "Guiones y diapositivas" })).toBeVisible();
  const toggle = page.getByRole("button", { name: /Cerrar/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toBeFocused();
  await expect(scene(page, 2).getByRole("textbox", { name: "Viñetas 2", exact: true })).toHaveAccessibleDescription(
    TOO_LONG,
  );
});

test("si producción no puede revisar el guion de un módulo, lo dice y deja reintentarlo", async ({ page, request }) => {
  const { courseId, moduleId } = await scriptedCourse(request, [COVER, RULES]);
  let failing = true; // the script (and its automatic retry) fails until the admin retries
  await page.route(`${API}/modules/${moduleId}/storyboard`, (route) => {
    if (!failing) return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ detail: "Internal Server Error" }),
    });
  });
  await producedCourse(page, courseId);

  // Not knowing isn't the same as "no warnings".
  const row = page.getByRole("listitem").filter({ hasText: "Uso del casco" });
  await expect(row).toContainText("No se pudieron revisar los avisos de diseño.");
  failing = false;
  await row.getByRole("button", { name: "Reintentar: avisos de diseño de Uso del casco" }).click();
  await expect(row).toContainText("Avisos de diseño: 1 escena con un texto que no cabe.");
  await expect(row).not.toContainText("No se pudieron revisar");
});
