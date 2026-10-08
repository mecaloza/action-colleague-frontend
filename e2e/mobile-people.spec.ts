import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { DECISION } from "./fixtures/activities";
import { adminApi, API, type Call, type CourseRef, learnerApi, newLearner, PASSWORD, publishedCourse } from "./fixtures/api";

// A person's page and the learner's ranking on a phone ("mobile" project: Pixel 7, touch, no hover), at the narrowest
// width we support.
test.setTimeout(150_000);
test.use({ viewport: { width: 360, height: 740 } });

/** Big enough for a finger (polled: a dialog or menu zooming in is smaller for a moment). */
async function expectTarget(locator: Locator, min = 40) {
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return box ? Math.min(box.width, box.height) : 0;
    })
    .toBeGreaterThanOrEqual(min);
}

/** Nothing is wider than the phone: neither the page nor an open dialog scrolls sideways. */
async function expectNoSidewaysScroll(page: Page) {
  const width = page.viewportSize()!.width;
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        return {
          page: document.documentElement.scrollWidth,
          // Chrome widens the layout viewport of a page that overflows: it must stay the phone's width.
          viewport: window.innerWidth,
          dialog: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
        };
      }),
    )
    .toEqual({ page: width, viewport: width, dialog: 0 });
}

/**
 * Checks a learner's page where the ranking shows (its tab, its card, its page). The parameters are global and a spec
 * running alongside may hide the ranking for a moment (people.spec.ts does): the page is reloaded until it shows again.
 */
async function whileShown(page: Page, check: () => Promise<void>) {
  let again = false;
  await expect(async () => {
    if (again) await page.reload();
    again = true;
    await check();
  }).toPass({ timeout: 45_000 });
}

/** Inside the screen from side to side (it may still be further down the page). */
async function expectWithinWidth(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
}

interface Choice {
  token: string;
  text: string;
}

/**
 * A learner with a long name on a path of one course: a conversation they played (10 of 10, through the API) and a
 * quiz of one attempt they failed.
 */
async function learnerWithResults(call: Call, request: APIRequestContext, stamp: number) {
  const learner = await newLearner(call, `María Fernanda de los Ángeles Castañeda ${stamp}`, {
    position: "Asesora de flotas de carretera",
    department: "Ventas regionales",
  });
  const course = await call<CourseRef>("post", "/courses", {
    title: `Presión, desgaste y rotación de llantas en las unidades de arrastre ${stamp}`,
  });
  const talk = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: "Conversación con el cliente que solo pide el precio más bajo",
    content_text: "Cómo atenderlo.",
  });
  const activity = await call<{ id: number }>("post", `/modules/${talk.id}/activities`, {
    type: "decision",
    title: "Cliente de una flota de carretera que pide precio",
    spec: DECISION,
    status: "ready",
  });
  const exam = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: "Evaluación final del curso de presión y desgaste",
    content_text: "Repasa antes de responder.",
  });
  await call("put", `/modules/${exam.id}/evaluation`, {
    questions: [{ id: "q1", type: "true_false", prompt: "La presión se mide en frío", correct: true, explanation: "Siempre." }],
    max_attempts: 1,
    passing_score: 100,
  });
  await call("post", `/courses/${course.id}/publish`);
  const path = await call<{ id: number; title: string }>("post", "/paths", {
    title: `Ruta del asesor de flotas de carretera durante sus primeros treinta días ${stamp}`,
  });
  await call("put", `/paths/${path.id}/courses`, { course_ids: [course.id] });
  await call("patch", `/paths/${path.id}`, { status: "published" });
  await call("post", `/paths/${path.id}/people`, { user_ids: [learner.id] });

  const learnerCall = await learnerApi(request, learner.email);
  type Play = { attempt_id: number; view: { node: { choices: Choice[] } } };
  type Move = { result: { next?: { choices: Choice[] } }; done: boolean };
  const play = await learnerCall<Play>("post", `/learn/activities/${activity.id}/attempts`, { untimed: false });
  const pick = (choices: Choice[], start: string) => choices.find((choice) => choice.text.startsWith(start))!.token;
  const first = await learnerCall<Move>("post", `/learn/activity-attempts/${play.attempt_id}/moves`, {
    move: { choice: pick(play.view.node.choices, "¿Qué ruta") },
  });
  const last = await learnerCall<Move>("post", `/learn/activity-attempts/${play.attempt_id}/moves`, {
    move: { choice: pick(first.result.next!.choices, "Le muestro") },
  });
  expect(last.done).toBe(true);
  const quiz = await learnerCall<{ version: string }>("get", `/learn/modules/${exam.id}/quiz`);
  await learnerCall("post", `/learn/modules/${exam.id}/quiz/attempts`, {
    answers: [{ question_id: "q1", response: { value: false } }],
    version: quiz.version,
  });
  return { learner, course, path };
}

test("la ficha de una persona en el celular: cabe y sus acciones se tocan con el dedo", async ({ page, request }) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const { learner, course } = await learnerWithResults(call, request, stamp);
  // Also a path and a course of short names: on a single line, their links are at their shortest.
  const brief = await publishedCourse(call, `Frenos ${stamp % 1000}`);
  const briefPath = await call<{ id: number; title: string }>("post", "/paths", { title: `Ruta ${stamp % 1000}` });
  await call("put", `/paths/${briefPath.id}/courses`, { course_ids: [brief.id] });
  await call("patch", `/paths/${briefPath.id}`, { status: "published" });
  await call("post", `/paths/${briefPath.id}/people`, { user_ids: [learner.id] });

  await page.goto(`/admin/team/${learner.id}`);
  await expect(page.getByRole("heading", { level: 1, name: learner.name })).toBeVisible({ timeout: 20_000 }); // a cold route
  await expectTarget(page.getByRole("link", { name: "Equipo" }));
  await expectTarget(page.getByRole("button", { name: "Editar datos" }));
  // The figures, two by two, inside the screen.
  const points = page.locator("dl > div").filter({ has: page.getByText("Puntos", { exact: true }) });
  await expect(points.locator("dd").first()).toHaveText("120");
  await expectWithinWidth(page, points);
  await expectNoSidewaysScroll(page);
  // The names of a path and of a course lead to their pages: finger-sized, short ones too.
  await expectTarget(page.getByRole("link", { name: briefPath.title, exact: true }));
  await expectTarget(page.getByRole("link", { name: brief.title, exact: true }));

  // Its course opens module by module; the quiz's actions take a finger and stay inside the screen.
  const card = page.getByRole("list", { name: "Sus cursos" }).getByRole("listitem").filter({ hasText: course.title }).first();
  const open = card.getByRole("button", { name: `Ver módulos de «${course.title}»` });
  await expectTarget(open);
  await open.tap();
  const exam = card.getByRole("listitem").filter({ hasText: "Evaluación final del curso" }).first();
  const retry = exam.getByRole("button", { name: /Dar otro intento/ });
  await expectTarget(retry);
  await expectWithinWidth(page, retry);
  const answers = exam.getByRole("button", { name: /Ver respuestas/ });
  await expectTarget(answers);
  await answers.tap();
  await expect(exam.getByRole("list", { name: "Sus intentos" })).toContainText("No aprobado");
  await expectNoSidewaysScroll(page);

  // Giving it back asks first; the confirmation fits.
  await retry.tap();
  const confirm = page.getByRole("dialog", { name: `¿Darle otro intento a ${learner.name}?` });
  await expectTarget(confirm.getByRole("button", { name: "Dar otro intento" }));
  await expectNoSidewaysScroll(page);
  await confirm.getByRole("button", { name: "Dar otro intento" }).tap();
  await expect(exam).toContainText("0 de 1 intento usado");

  // Their certificates and their latest activity fit too.
  await expect(page.getByRole("list", { name: "Actividad reciente" })).toContainText("No aprobó la evaluación de");
  await expectNoSidewaysScroll(page);
});

test.describe("colaborador", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // signed in as the learner, not the admin

  test("el ranking en el celular: la barra de abajo, la lista y su posición a la vista", async ({ page, request }) => {
    const call = await adminApi(request);
    const stamp = Date.now();
    const { learner, path } = await learnerWithResults(call, request, stamp);

    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(learner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /Ingresar/ }).tap();
    await expect(page).toHaveURL(/\/learn$/, { timeout: 20_000 }); // a cold route

    // The sections in a bar at the bottom, within the thumb's reach; no menu button for a learner.
    const tabs = page.getByRole("navigation", { name: "Principal" });
    await whileShown(page, async () => {
      for (const name of ["Inicio", "Ranking", "Perfil"]) {
        const tab = tabs.getByRole("link", { name });
        await expect(tab).toBeInViewport({ ratio: 1, timeout: 5_000 });
        await expectTarget(tab);
      }
    });
    await expect(tabs.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveCount(0);
    // Signing out lives in their own menu (their initials), finger-sized.
    await page.getByRole("button", { name: `Menú de ${learner.name}` }).tap();
    await expectTarget(page.getByRole("menuitem", { name: "Cerrar sesión" }));
    await page.keyboard.press("Escape");

    // Today's card, in their path, fits.
    const today = page.getByRole("region", { name: "Ranking" });
    await whileShown(page, () => expect(today).toContainText(`Hoy en ${path.title}: #`, { timeout: 5_000 }));
    await expectWithinWidth(page, today);
    await expectNoSidewaysScroll(page);

    // The ranking page: the list and their own place, pinned above the bar.
    const mine = page.getByRole("list", { name: /^Los mejores de hoy/ }).getByRole("listitem").filter({ hasText: "Tú" });
    const place = page.getByText("Tu posición").locator("xpath=ancestor::div[contains(@class, 'sticky')][1]");
    const periods = page.getByRole("group", { name: "Periodo" });
    await whileShown(page, async () => {
      await tabs.getByRole("link", { name: "Ranking" }).tap({ timeout: 5_000 });
      await expect(page).toHaveURL(/\/learn\/ranking$/);
      await expect(mine).toContainText("120 pts", { timeout: 5_000 });
      await expect(tabs.getByRole("link", { name: "Ranking" })).toHaveAttribute("aria-current", "page");
      await expectWithinWidth(page, mine);
      await expect(place).toBeInViewport({ ratio: 1 });
      const placeBox = (await place.boundingBox())!;
      const barBox = (await tabs.boundingBox())!;
      expect(placeBox.y + placeBox.height).toBeLessThanOrEqual(barBox.y + 1);
      for (const period of ["Hoy", "Semana", "Mes", "Total"]) {
        await expectTarget(periods.getByRole("button", { name: period }));
      }
    });
    // Another period: its list is asked for (it may come hidden for a moment too).
    await whileShown(page, async () => {
      await periods.getByRole("button", { name: "Mes" }).tap({ timeout: 5_000 });
      await expect(page.getByRole("list", { name: /^Los mejores del mes/ })).toContainText("120 pts", { timeout: 5_000 });
    });
    await expect(page.getByRole("heading", { level: 1, name: "Los mejores del mes" })).toBeVisible();
    await expectTarget(page.getByLabel("Ranking de"));
    await expectNoSidewaysScroll(page);

    // The other tabs.
    await tabs.getByRole("link", { name: "Perfil" }).tap();
    await expect(page).toHaveURL(/\/profile$/);
    await tabs.getByRole("link", { name: "Inicio" }).tap();
    await expect(page).toHaveURL(/\/learn$/);
  });

  test("la pestaña del ranking: guarda su lugar mientras pregunta y no aparece si los parámetros lo ocultan", async ({
    page,
    request,
  }) => {
    const call = await adminApi(request);
    const learner = await newLearner(call, `Colaboradora de la barra ${Date.now()}`);
    // The parameters answer when the test says, with what it says (not changed for real: other specs read them).
    let visible = true;
    let release = (): void => undefined;
    let gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    await page.route(`${API}/learn/settings`, async (route) => {
      await gate;
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json()), ranking_visible: visible } });
    });

    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(learner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /Ingresar/ }).tap();
    await expect(page).toHaveURL(/\/learn$/, { timeout: 20_000 }); // a cold route

    // While it asks: no "Ranking" to tap, but its place is kept.
    const tabs = page.getByRole("navigation", { name: "Principal" });
    const ranking = tabs.getByRole("link", { name: "Ranking" });
    const profile = tabs.getByRole("link", { name: "Perfil" });
    await expect(profile).toBeInViewport({ ratio: 1 });
    await expect(ranking).toHaveCount(0);
    const kept = (await profile.boundingBox())!;
    // Shown: it comes to its place, and the other tabs stay where the finger expects them.
    release();
    await expect(ranking).toBeInViewport({ ratio: 1 });
    expect((await profile.boundingBox())!.x).toBe(kept.x);

    // Hidden: it never shows, not even while it asks; then the other two share the bar.
    visible = false;
    gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    await page.reload();
    await expect(profile).toBeInViewport({ ratio: 1 });
    await expect(ranking).toHaveCount(0);
    const answered = page.waitForResponse(`${API}/learn/settings`);
    release();
    await answered;
    await expect.poll(async () => (await profile.boundingBox())?.x).toBeLessThan(kept.x);
    await expect(ranking).toHaveCount(0);
    await expectTarget(profile);
  });
});
