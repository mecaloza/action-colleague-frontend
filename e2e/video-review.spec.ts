import { test, expect, type Page, type Request } from "@playwright/test";
import { adminApi } from "./fixtures/api";
import {
  BLACK,
  CUT,
  CUT_FIX,
  fakeReview,
  fakeReviews,
  MARKED,
  MARKED_FIX,
  MISMATCH,
  reviewedCourse,
} from "./fixtures/reviews";
import { MODULE_TITLE, scriptedCourse } from "./fixtures/scripts";

// "Revisión de calidad": the automatic review of a module's AI video, against a backend with fake providers (a video is
// really produced and reviewed: see fixtures/reviews.ts), or faked in the browser for the states the fake AI can't give.
test.setTimeout(240_000);

/** The module's row in the course editor (the innermost item: the list holds them all). */
const rowOf = (page: Page) => page.getByRole("listitem").filter({ hasText: MODULE_TITLE }).last();

/** The module's chip: what its video's review found, at a glance (its name says it whole). */
const chipOf = (page: Page) => rowOf(page).getByRole("button", { name: /^Revisión de calidad de / });

const sheetOf = (page: Page) => page.getByRole("dialog", { name: "Revisión de calidad" });

/** Opens the review from the module's chip, through its popover. */
async function openFromChip(page: Page, item = "Ver la revisión") {
  await chipOf(page).click();
  await page.getByRole("menu").getByRole("menuitem", { name: item }).click();
  await expect(sheetOf(page)).toBeVisible();
}

const isProposal = (moduleId: number) => (request: Request) =>
  request.url().endsWith(`/modules/${moduleId}/revisions`) && request.method() === "POST";
const isReviewRequest = (moduleId: number) => (request: Request) =>
  request.url().endsWith(`/modules/${moduleId}/review`) && request.method() === "POST";

test("la revisión encuentra un problema crítico: se ve en los fotogramas y en el video, se ignora, impide publicar y «Corregir» lo arregla en el guion", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await reviewedCourse(call, "Revisión de calidad");
  const review = await call<{ id: number; issues: { id: string; at_seconds: number }[] }>(
    "get",
    `/modules/${moduleId}/review`,
  );
  const [issue] = review.issues;
  const before = await call<{ qa: { auto_review: boolean; block_publish: boolean } }>("get", "/settings");
  expect(before.qa.auto_review).toBe(true);
  try {
    // The module says it at a glance; a tap tells more and leads to the review.
    await page.goto(`/admin/courses/${courseId}`);
    const chip = chipOf(page);
    await expect(chip).toContainText("1 crítico");
    await expect(chip).toHaveAccessibleName(
      `Revisión de calidad de ${MODULE_TITLE}: Queda 1 problema crítico por corregir.`,
    );
    await chip.click();
    const popover = page.getByRole("menu");
    await expect(popover).toContainText("Queda 1 problema crítico por corregir.");
    await popover.getByRole("menuitem", { name: "Ver la revisión" }).click();

    // What it found, scene by scene: how serious, what, who found it.
    const sheet = sheetOf(page);
    await expect(sheet.getByRole("heading", { name: "Hay problemas por corregir" })).toBeVisible();
    await expect(sheet).toContainText("Encontré 1 problema(s) en los fotogramas.");
    await expect(sheet).toContainText("Encontró 1 hallazgo: 1 crítico. Queda 1 problema crítico por corregir.");
    // (Named with the scene's title as the script has it now: «Corregir» below retitles it.)
    await expect(sheet.getByRole("group", { name: /^Escena 02 · Reglas del casco/ })).toBeVisible();
    const scene = sheet.getByRole("group", { name: /^Escena 02 · / });
    const finding = scene.getByRole("listitem", { name: MARKED });
    await expect(finding).toContainText("Crítico");
    await expect(finding).toContainText("Texto cortado");
    await expect(finding).toContainText("Lo vio la IA en los fotogramas");
    // Its frame, with what was found drawn where it was seen (the fake AI: the top-left quarter).
    await expect(finding.locator("[data-qa-box]")).toHaveCount(1);

    // The frames it looked at: each scene's, and others at random; the one with the finding is marked.
    const frames = sheet.getByRole("region", { name: /^Fotogramas revisados/ });
    expect(await frames.getByRole("button").count()).toBeGreaterThanOrEqual(6);
    await frames.getByRole("button", { name: /escena 02, 1 hallazgo$/ }).click();
    const enlarged = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Fotograma siguiente" }) });
    await expect(enlarged).toHaveAccessibleName(/^Escena 02 · \d+:\d{2}$/);
    await expect(enlarged.locator("[data-qa-box]")).toHaveAttribute(
      "style",
      "left: 0%; top: 0%; width: 50%; height: 50%;",
    );
    await expect(enlarged.getByRole("list", { name: "Lo que se encontró en el fotograma" })).toContainText(MARKED);
    // The others, one after the other (past the last one, the first), with a tap or the arrow keys.
    const counter = enlarged.getByText(/^\d+ de \d+$/);
    const [shown, total] = (await counter.textContent())!.split(" de ").map(Number);
    await enlarged.getByRole("button", { name: "Fotograma siguiente" }).click();
    await expect(counter).toHaveText(`${(shown % total) + 1} de ${total}`);
    await page.keyboard.press("ArrowLeft");
    await expect(counter).toHaveText(`${shown} de ${total}`);
    await page.keyboard.press("Escape");
    await expect(enlarged).toBeHidden();

    // In the video: the player opens where it was seen.
    await finding.getByRole("button", { name: "Ver en el video" }).click();
    const moment = page.getByRole("dialog", { name: /^En el video: / });
    await expect(moment).toContainText(MARKED);
    await expect
      .poll(() => moment.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime))
      .toBeCloseTo(issue.at_seconds, 1);
    await page.keyboard.press("Escape");
    await expect(moment).toBeHidden();

    // Ignored: nothing is left to do (and the module says so); the same button opens it again.
    await finding.getByRole("button", { name: "Ignorar" }).click();
    await expect(finding).toContainText("Ignorado");
    const reopen = finding.getByRole("button", { name: "Reabrir" });
    await expect(reopen).toBeFocused();
    await expect(sheet.getByRole("heading", { name: "No quedan pendientes" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(chipOf(page)).toContainText("Sin pendientes");
    await openFromChip(page);
    await reopen.click();
    await expect(finding).not.toContainText("Ignorado");
    await expect(reopen).toBeHidden(); // open again: «Corregir» in its place
    await page.keyboard.press("Escape");
    await expect(chipOf(page)).toContainText("1 crítico");

    // Parámetros: critical findings keep a course from being published.
    await page.goto("/admin/settings");
    const qa = page.getByRole("region", { name: "Revisión de calidad" });
    await expect(qa.getByRole("switch", { name: "Revisar cada video al producirlo" })).toBeChecked();
    const block = qa.getByRole("switch", { name: "Los problemas críticos impiden publicar" });
    if (!(await block.isChecked())) {
      await block.click();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Parámetros guardados")).toBeVisible();
    }
    expect((await call<typeof before>("get", "/settings")).qa).toEqual({ auto_review: true, block_publish: true });

    // Publishing says why it can't, with a way to the review.
    await page.goto(`/admin/courses/${courseId}`);
    await page.getByRole("button", { name: "Publicar" }).click();
    const problems = page.getByRole("dialog", { name: "Falta poco para publicar" });
    await expect(problems).toContainText(
      `La revisión del video de «${MODULE_TITLE}» encontró 1 problema crítico: corrígelo o ignóralo para publicar`,
    );
    await expect(problems.getByRole("region", { name: "Revisión de calidad" })).toContainText(
      "1 video con problemas críticos.",
    );
    await problems.getByRole("button", { name: "Ver la revisión" }).click();
    await expect(problems).toBeHidden();
    await expect(sheetOf(page)).toBeVisible();

    // «Corregir»: a change to scene 2's script, asked with what the review suggests (it can be reworded).
    await finding.getByRole("button", { name: "Corregir" }).click();
    const change = page.getByRole("dialog", { name: "Cambios al guion" });
    await expect(change.getByLabel("¿Qué quieres cambiar?")).toHaveValue(MARKED_FIX);
    await expect(change.getByRole("button", { name: /^Escena 02 · Reglas del casco/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(change).toContainText(
      `Corrige lo que encontró la revisión de calidad: «${MARKED.replace(/\.$/, "")}». Al aplicar el cambio, el hallazgo queda corregido.`,
    );
    const [asked] = await Promise.all([
      page.waitForRequest(isProposal(moduleId)),
      change.getByRole("button", { name: "Pedir propuesta" }).click(),
    ]);
    expect(asked.postDataJSON()).toEqual({
      target: "script",
      observation: MARKED_FIX,
      scene_ids: ["s2"],
      qa_issue_id: issue.id,
    });
    await expect(change.getByRole("heading", { name: "Propuesta de la IA" })).toBeVisible({ timeout: 60_000 });
    await expect(change).toContainText("Corrige un hallazgo de la revisión de calidad");
    await change.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(change).toBeHidden();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Cambio aplicado" })).toContainText(
      "El hallazgo de la revisión de calidad quedó corregido.",
    );
    // Back on the review: fixed (the video shows it once produced again); the focus where it was.
    await expect(finding).toContainText("Corregido");
    await expect(finding).toContainText("Se corrigió en el guion: el video lo mostrará cuando lo vuelvas a producir.");
    await expect(reopen).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(chipOf(page)).toContainText("Sin pendientes");

    // Nothing critical is open: the course is published.
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Curso publicado: ya lo ven las personas asignadas")).toBeVisible();

    // Reviewed again, with new frames of the published video (still the old script): the finding is back, open. The
    // focus follows the review from its progress to its result.
    await openFromChip(page);
    await sheet.getByRole("button", { name: "Revisar de nuevo" }).click();
    await expect(sheet.getByRole("heading", { name: "Hay problemas por corregir" })).toBeFocused({ timeout: 60_000 });
    await expect(sheet.getByRole("listitem", { name: MARKED })).not.toContainText("Corregido");
    expect((await call<{ id: number }>("get", `/modules/${moduleId}/review`)).id).not.toBe(review.id);
    await page.keyboard.press("Escape");
    await expect(chipOf(page)).toContainText("1 crítico");
  } finally {
    await call("patch", "/settings", { qa: { block_publish: before.qa.block_publish } });
  }
});

test("el panel sigue la revisión mientras se hace, dice si falla, deja revisar de nuevo y el estudio la resume", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Revisión simulada");
  // The module's video has no review yet (made before reviews, or with them turned off).
  const fake = await fakeReviews(page, courseId, moduleId, null);
  const posts: string[] = [];
  page.on("request", (sent) => {
    if (isReviewRequest(moduleId)(sent)) posts.push(sent.url());
  });

  await page.goto(`/admin/courses/${courseId}`);
  await expect(chipOf(page)).toContainText("Sin revisar");
  await chipOf(page).click();
  await expect(page.getByRole("menu")).toContainText("Este video todavía no tiene revisión.");
  await page.getByRole("menuitem", { name: "Revisar el video" }).click();
  const sheet = sheetOf(page);
  await expect(sheet.getByRole("heading", { name: "Este video aún no tiene revisión" })).toBeVisible();

  // Asked for: it is followed while the AI looks at the frames (the button waits meanwhile).
  await Promise.all([
    page.waitForRequest(isReviewRequest(moduleId)),
    sheet.getByRole("button", { name: "Revisar ahora" }).click(),
  ]);
  await expect(sheet.getByRole("heading", { name: "Revisando el video" })).toBeFocused();
  await expect(sheet.getByRole("status")).toContainText("Revisando los fotogramas con IA");
  const again = sheet.getByRole("button", { name: "Revisar de nuevo" });
  await expect(again).toHaveAttribute("aria-disabled", "true");
  await expect(again).toHaveAccessibleDescription("La revisión está en curso: puedes cerrar este panel.");
  await expect.poll(() => posts.length).toBe(1);
  await page.keyboard.press("Escape");
  await expect(chipOf(page)).toContainText("Revisando");

  // It fails: said, with what the video's own checks found meanwhile (a black screen: producing it again fixes it).
  fake.review = fakeReview(901, moduleId, {
    status: "error",
    verdict: null,
    summary: "",
    error: "El servicio de IA rechazó las imágenes.",
    issues: fakeReview(901, moduleId).issues.filter((issue) => issue.source === "video"),
  });
  await expect(chipOf(page)).toContainText("1 hallazgo", { timeout: 15_000 });
  await openFromChip(page);
  await expect(sheet.getByRole("heading", { name: "No se pudo completar la revisión" })).toBeVisible();
  await expect(sheet).toContainText("El servicio de IA rechazó las imágenes.");
  const black = sheet.getByRole("group", { name: /^Escena 03/ }).getByRole("listitem", { name: BLACK });
  await expect(black).toContainText("Un cambio al guion no lo arregla: vuelve a producir el video.");
  await expect(black.getByRole("button", { name: "Corregir" })).toHaveCount(0);
  await expect(black.getByRole("button", { name: "Ignorar" })).toBeVisible();

  // Asked again: this time it is done.
  await Promise.all([page.waitForRequest(isReviewRequest(moduleId)), again.click()]);
  await expect.poll(() => posts.length).toBe(2);
  await expect(sheet.getByRole("heading", { name: "Revisando el video" })).toBeVisible();
  fake.review = fakeReview(902, moduleId);
  await expect(sheet.getByRole("heading", { name: "Hay problemas por corregir" })).toBeVisible({ timeout: 15_000 });
  await expect(sheet).toContainText("Encontró 3 hallazgos: 1 crítico, 1 importante y 1 menor.");
  // By scene in the video's order, each with what can be done.
  const groups = sheet.getByRole("region", { name: "Hallazgos" }).getByRole("group");
  await expect(groups).toHaveCount(3);
  await expect(groups.nth(0)).toHaveAccessibleName(/^Escena 01 · Seguridad en planta/);
  await expect(groups.nth(1)).toHaveAccessibleName(/^Escena 02 · Reglas del casco/);
  await expect(groups.nth(2)).toHaveAccessibleName(/^Escena 03 · Para recordar/);
  const cut = groups.nth(1).getByRole("listitem", { name: CUT });
  await expect(cut.getByRole("button", { name: "Corregir" })).toBeVisible();
  await expect(cut.getByRole("button", { name: "Ver en el video" })).toBeVisible();
  await expect(groups.nth(0).getByRole("listitem", { name: MISMATCH })).toContainText("Lo encontró la IA al leer el guion");
  // The enlarged frame draws the finding where it was seen.
  await cut.getByRole("button", { name: /^Ver en grande el fotograma/ }).click();
  const enlarged = page.getByRole("dialog", { name: "Escena 02 · 0:06" });
  await expect(enlarged.locator("[data-qa-box]")).toHaveAttribute("style", "left: 55%; top: 40%; width: 43%; height: 22%;");
  await page.keyboard.press("Escape");
  // «Corregir» asks for the change the review suggests, on its scene.
  await cut.getByRole("button", { name: "Corregir" }).click();
  const change = page.getByRole("dialog", { name: "Cambios al guion" });
  await expect(change.getByLabel("¿Qué quieres cambiar?")).toHaveValue(CUT_FIX);
  await page.keyboard.press("Escape");
  await expect(change).toBeHidden();
  await expect(cut.getByRole("button", { name: "Corregir" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(chipOf(page)).toContainText("1 crítico");

  // The module's panel says it too, and opens the review over it.
  await rowOf(page).getByRole("button", { name: `Editar ${MODULE_TITLE}` }).click();
  const modulePanel = page.getByRole("dialog", { name: MODULE_TITLE });
  const section = modulePanel.getByRole("region", { name: "Revisión de calidad" });
  await expect(section).toContainText("Quedan 3 hallazgos por revisar, 1 de ellos crítico.");
  await section.getByRole("button", { name: "Ver la revisión" }).click();
  await expect(sheet.getByRole("heading", { name: "Hay problemas por corregir" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(modulePanel).toBeVisible();
  await expect(section.getByRole("button", { name: "Ver la revisión" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modulePanel).toBeHidden();

  // The studio, once the videos are produced, sums up how their reviews went, with the way to each one.
  await page.goto(`/admin/courses/${courseId}/studio`);
  await expect(page.getByRole("heading", { name: "Tu curso está producido." })).toBeVisible();
  const summary = page.getByRole("region", { name: "Revisión de calidad" });
  await expect(summary).toContainText("1 video con problemas críticos.");
  const studioRow = page.getByRole("listitem").filter({ hasText: "Video de 0:14" });
  await expect(studioRow.getByRole("button", { name: /^Revisión de calidad de / })).toContainText("1 crítico");
  await summary.getByRole("button", { name: `Ver la revisión de ${MODULE_TITLE}` }).click();
  await expect(sheet.getByRole("heading", { name: "Hay problemas por corregir" })).toBeVisible();
});
