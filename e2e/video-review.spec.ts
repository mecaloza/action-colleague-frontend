import { test, expect, type Page, type Request } from "@playwright/test";
import { adminApi, API } from "./fixtures/api";
import {
  BLACK,
  CUT,
  CUT_FIX,
  fakeReview,
  fakeReviews,
  jsonReply,
  MARKED,
  MARKED_FIX,
  MISMATCH,
  OVERLAP,
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

    // Parámetros: each video is reviewed as it is produced (turned off and saved, then on again: this video was
    // reviewed already, and no other spec waits for a review), and critical findings keep a course from being published.
    await page.goto("/admin/settings");
    const qa = page.getByRole("region", { name: "Revisión de calidad" });
    const auto = qa.getByRole("switch", { name: "Revisar cada video al producirlo" });
    const block = qa.getByRole("switch", { name: "Los problemas críticos impiden publicar" });
    /** Saves the form: what it sent, once saved. */
    const saveSettings = async () => {
      const [sent] = await Promise.all([
        page.waitForRequest((sent) => sent.url().endsWith("/settings") && sent.method() === "PATCH"),
        page.getByRole("button", { name: "Guardar cambios" }).click(),
      ]);
      await expect(page.getByText("Todo guardado.")).toBeVisible();
      return sent.postDataJSON();
    };
    await expect(auto).toBeChecked();
    await auto.click();
    await expect(page.getByText("Cambios sin guardar.")).toBeVisible();
    expect(await saveSettings()).toEqual({ qa: { auto_review: false } });
    await expect(page.getByText("Parámetros guardados")).toBeVisible();
    await expect(auto).not.toBeChecked();
    expect((await call<typeof before>("get", "/settings")).qa.auto_review).toBe(false);
    await auto.click();
    const blocking = await block.isChecked();
    if (!blocking) await block.click();
    const turnedOn = blocking ? { auto_review: true } : { auto_review: true, block_publish: true };
    expect(await saveSettings()).toEqual({ qa: turnedOn });
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
    await call("patch", "/settings", { qa: before.qa });
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

test("«Corregir» vuelve a la propuesta pedida para su hallazgo aunque se haya reescrito, nunca a la de otro hallazgo con la misma sugerencia", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Corregir dos hallazgos");
  // Scene 2 has two findings that suggest the very same change: each «Corregir» is about its own.
  const found = fakeReview(903, moduleId);
  const [cut] = found.issues;
  const overlap = { ...cut, id: "903-4", category: "overlap", at_seconds: 7.9, frame_index: 4, description: OVERLAP };
  await fakeReviews(page, courseId, moduleId, fakeReview(903, moduleId, { issues: [...found.issues, overlap] }));
  const asked: unknown[] = [];
  page.on("request", (sent) => {
    if (isProposal(moduleId)(sent)) asked.push(sent.postDataJSON());
  });

  await page.goto(`/admin/courses/${courseId}`);
  await openFromChip(page);
  const sheet = sheetOf(page);
  const change = page.getByRole("dialog", { name: "Cambios al guion" });
  const field = change.getByLabel("¿Qué quieres cambiar?");
  const proposal = change.getByRole("heading", { name: "Propuesta de la IA" });
  /** «Corregir» on the finding: the change's panel opens over the review. */
  const fix = async (description: string) => {
    await sheet.getByRole("listitem", { name: description }).getByRole("button", { name: "Corregir" }).click();
    await expect(change).toBeVisible();
  };
  /** Asks for the change, waits for the AI's proposal (it waits for review) and closes the panel. */
  const ask = async () => {
    await change.getByRole("button", { name: "Pedir propuesta" }).click();
    await expect(proposal).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("Escape");
    await expect(change).toBeHidden();
  };

  // The first finding's change, asked as suggested.
  await fix(CUT);
  await expect(field).toHaveValue(CUT_FIX);
  await ask();
  expect(asked).toEqual([{ target: "script", observation: CUT_FIX, scene_ids: ["s2"], qa_issue_id: "903-1" }]);

  // The other finding suggests the same words: its own form, saying it replaces the proposal waiting.
  await fix(OVERLAP);
  await expect(field).toHaveValue(CUT_FIX);
  await expect(change).toContainText(`Corrige lo que encontró la revisión de calidad: «${OVERLAP.replace(/\.$/, "")}».`);
  await expect(change).toContainText(`La propuesta anterior («${CUT_FIX}») se reemplaza por la que pidas ahora.`);
  // Reworded before asking.
  const reworded = `${CUT_FIX} Que el título no tape ningún punto.`;
  await field.fill(reworded);
  await ask();
  expect(asked[1]).toEqual({ target: "script", observation: reworded, scene_ids: ["s2"], qa_issue_id: "903-4" });

  // «Corregir» on it again: the proposal asked for it, still waiting (nothing is asked, nor replaced).
  await fix(OVERLAP);
  await expect(proposal).toBeVisible();
  await expect(change).toContainText(`Pediste: «${reworded}»`);
  await expect(field).toHaveCount(0);
  expect(asked).toHaveLength(2);
});

test("ignorar espera al servidor sin perder el foco ni dejar corregir, dos hallazgos ignorados seguidos quedan ignorados y una revisión que no se pudo leer no ofrece otra", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Ignorar hallazgos");
  const fake = await fakeReviews(page, courseId, moduleId, fakeReview(904, moduleId));
  const dismissal = new RegExp(`${API}/reviews/904/issues/[^/]+/dismiss$`);
  /** A request held until the test lets it go. */
  const held = () => {
    let release = () => {};
    const until = new Promise<void>((resolve) => (release = resolve));
    return { until, release };
  };

  // The review can't be read at first (the server fails): it says so, and offers no review of the video meanwhile
  // (it may have one already: another would be made, and paid for).
  let unreadable = true;
  await page.route(`${API}/modules/${moduleId}/review`, (route) =>
    unreadable && route.request().method() === "GET"
      ? route.fulfill(jsonReply({ detail: "Error interno del servidor" }, 500))
      : route.fallback(),
  );
  await page.goto(`/admin/courses/${courseId}`);
  await openFromChip(page);
  const sheet = sheetOf(page);
  await expect(sheet.getByText("No pudimos cargar esta información.")).toBeVisible({ timeout: 15_000 }); // after a retry
  await expect(sheet.getByRole("button", { name: /^Revisar (ahora|de nuevo)$/ })).toHaveCount(0);
  unreadable = false;
  await sheet.getByRole("button", { name: "Reintentar" }).click();
  await expect(sheet.getByRole("heading", { name: "Hay problemas por corregir" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Revisar de nuevo" })).toBeVisible();

  // Ignoring waits for the server, and meanwhile no change is asked for the finding; if it fails, the focus is still
  // on «Ignorar», to try again.
  const failing = held();
  await page.route(
    dismissal,
    async (route) => {
      await failing.until;
      await route.fulfill(jsonReply({ detail: "Error interno del servidor" }, 500));
    },
    { times: 1 },
  );
  const cut = sheet.getByRole("listitem", { name: CUT });
  const fixIt = cut.getByRole("button", { name: "Corregir" });
  const ignore = cut.getByRole("button", { name: "Ignorar" });
  await ignore.click();
  await expect(ignore).toHaveAttribute("aria-busy", "true");
  await expect(ignore).toBeFocused();
  await expect(fixIt).toBeDisabled();
  failing.release();
  await expect(ignore).not.toHaveAttribute("aria-busy", "true");
  await expect(ignore).toBeFocused();
  await expect(fixIt).toBeEnabled();
  await expect(cut).not.toContainText("Ignorado");

  // Two findings ignored one right after the other, the first answer coming last: with the review as the server had it
  // then (the second finding still open). Both stay ignored, and the focus stays on the second one.
  const black = sheet.getByRole("listitem", { name: BLACK });
  const first = held();
  await page.route(
    dismissal,
    async (route) => {
      const [, issueId] = /\/issues\/([^/]+)\/dismiss$/.exec(route.request().url())!;
      const issue = fake.review!.issues.find((each) => each.id === decodeURIComponent(issueId))!;
      issue.status = "dismissed";
      const answer = jsonReply(fake.review); // the review as it is now
      if (issue.description === CUT) await first.until;
      await route.fulfill(answer);
    },
    { times: 2 },
  );
  // The review read again once the second one is saved (its module's count changed), before the first answer comes.
  const readAgain = page.waitForResponse(
    async (response) =>
      response.url().endsWith(`/modules/${moduleId}/review`) &&
      response.request().method() === "GET" &&
      (await response.json()).issues.some(
        (issue: { description: string; status: string }) => issue.description === BLACK && issue.status === "dismissed",
      ),
  );
  await ignore.click();
  await black.getByRole("button", { name: "Ignorar" }).click();
  await expect(black).toContainText("Ignorado");
  await readAgain;
  first.release();
  await expect(cut.locator('[aria-busy="true"]')).toHaveCount(0); // its answer came
  await expect(cut).toContainText("Ignorado");
  await expect(black).toContainText("Ignorado");
  await expect(black.getByRole("button", { name: "Reabrir" })).toBeFocused();
});
