import { test, expect, type Locator, type Page } from "@playwright/test";
import { adminApi, type Call, newLearner, PASSWORD, publishedCourse } from "./fixtures/api";

// Learning paths on a phone ("mobile" project: Pixel 7, touch, no hover), at the narrowest width we support.
test.setTimeout(120_000);
test.use({ viewport: { width: 360, height: 740 } });

/** A published path with a deadline and three courses of long titles, assigned by hand to `userId`. */
async function longPath(call: Call, stamp: number, userId: number) {
  const courses = [];
  for (const title of [
    "Vender costo por kilómetro y mantenimiento preventivo a las flotas de carretera",
    "Presión, desgaste y rotación de llantas en las unidades de arrastre",
    "Cierre",
  ]) {
    courses.push(await publishedCourse(call, `${title} ${stamp}`));
  }
  // A title that doesn't say "Ruta": the course's header adds it.
  const path = await call<{ id: number; title: string }>("post", "/paths", {
    title: `Asesor de flotas de carretera durante sus primeros treinta días ${stamp}`,
    description: "Todo lo que un asesor nuevo necesita para su primera visita a una flota.",
  });
  await call("put", `/paths/${path.id}/courses`, { course_ids: courses.map((course) => course.id) });
  await call("patch", `/paths/${path.id}`, { status: "published", settings: { due_days: 30 } });
  await call("post", `/paths/${path.id}/people`, { user_ids: [userId] });
  return { path, courses };
}

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

/** Inside the screen from side to side (it may still be further down the page). */
async function expectWithinWidth(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test.describe("colaborador", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // signed in as the learner, not the admin

  test("«Mi ruta» en el celular: cabe, dice qué sigue y el botón para seguir está a la mano", async ({ page, request }) => {
    const call = await adminApi(request);
    const stamp = Date.now();
    const learner = await newLearner(call, `Celular ruta ${stamp}`);
    const { path, courses } = await longPath(call, stamp, learner.id);

    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(learner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /Ingresar/ }).tap();
    await expect(page).toHaveURL(/\/learn$/, { timeout: 20_000 }); // a cold route

    await expect(page.getByRole("heading", { level: 2, name: "Mi ruta" })).toBeVisible();
    const journey = page.getByRole("article", { name: path.title });
    await expect(journey).toContainText("Vence el");
    await expect(journey).toContainText(`Se desbloquea al terminar «${courses[0].title}»`);
    // The long titles wrap: the button to go on fits the screen and takes a finger.
    const go = journey.getByRole("link", { name: `Empezar: ${courses[0].title}` });
    await go.scrollIntoViewIfNeeded();
    await expect(go).toBeInViewport({ ratio: 1 });
    await expectTarget(go);
    await expectWithinWidth(page, go);
    await expectNoSidewaysScroll(page);
    // Locked courses are no links, in the path or in "Por empezar".
    await expect(page.getByRole("link", { name: new RegExp(courses[1].title) })).toHaveCount(0);

    await go.tap();
    await expect(page.getByRole("heading", { level: 1, name: courses[0].title })).toBeVisible();
    await expect(page.getByText(`Ruta ${path.title} · curso 1 de 3`, { exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page);

    // The last course by its address: a lock screen that fits, and the way to the course that opens it.
    await page.goto(`/learn/${courses[2].id}`);
    await expect(page.getByRole("heading", { name: "Este curso aún está bloqueado" })).toBeVisible();
    const unlock = page.getByRole("link", { name: `Ir a «${courses[0].title}»` });
    await expectTarget(unlock);
    await expectWithinWidth(page, unlock);
    await expectNoSidewaysScroll(page);
  });
});

test("las rutas del admin en el celular: tarjetas, cabecera, cursos, personas y ajustes caben", async ({ page, request }) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const learner = await newLearner(call, `Persona de la ruta con un nombre largo ${stamp}`);
  const { path, courses } = await longPath(call, stamp, learner.id);

  await page.goto("/admin/paths");
  const card = page.getByRole("link", { name: new RegExp(path.title) });
  await expect(card).toBeVisible({ timeout: 20_000 }); // a cold route
  await expectNoSidewaysScroll(page);

  await card.tap();
  await expect(page.getByRole("heading", { level: 1, name: path.title })).toBeVisible({ timeout: 20_000 });
  // The header: its main action in sight, the rest in the menu, both finger-sized.
  await expectTarget(page.getByRole("button", { name: "Pasar a borrador" }));
  await expectTarget(page.getByRole("button", { name: "Más acciones" }));
  // Each course moves with arrows and leaves with a button, all finger-sized.
  await expectTarget(page.getByRole("button", { name: `Bajar ${courses[0].title}` }));
  await expectTarget(page.getByRole("button", { name: `Quitar ${courses[0].title} de la ruta` }));
  await expectNoSidewaysScroll(page);
  // Its picker opens without the keyboard: on a touch screen it starts on the dialog, not on the search.
  await page.getByRole("button", { name: "Agregar cursos" }).first().tap();
  const coursePicker = page.getByRole("dialog", { name: "Agregar cursos" });
  await expect(coursePicker).toBeFocused();
  await expectNoSidewaysScroll(page);
  await coursePicker.getByRole("button", { name: "Cancelar" }).tap();
  await expect(coursePicker).toBeHidden();

  // People are cards on a phone, with "Quitar" in reach.
  await page.getByRole("tab", { name: "Personas" }).tap();
  const person = page
    .getByRole("list", { name: "Personas de la ruta" })
    .getByRole("listitem")
    .filter({ hasText: learner.name });
  await expect(person).toContainText("Manual");
  await expect(person).toContainText("Vence el");
  const remove = person.getByRole("button", { name: `Quitar la ruta a ${learner.name}` });
  await expectTarget(remove);
  await expectWithinWidth(page, remove);
  await expectNoSidewaysScroll(page);
  await page.getByRole("button", { name: "Asignar personas" }).first().tap();
  const peoplePicker = page.getByRole("dialog", { name: "Asignar personas" });
  await expect(peoplePicker).toBeFocused();
  await expect(peoplePicker.getByLabel("Buscar personas")).not.toBeFocused();
  await expectNoSidewaysScroll(page);
  await peoplePicker.getByRole("button", { name: "Cancelar" }).tap();
  await expect(peoplePicker).toBeHidden();

  await page.getByRole("tab", { name: "Ajustes" }).tap();
  await expect(page.getByLabel("Plazo (días)")).toHaveValue("30");
  await expectNoSidewaysScroll(page);
});
