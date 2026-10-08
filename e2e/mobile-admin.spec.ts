import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { DECISION } from "./fixtures/activities";

// The admin's side on a phone ("mobile" project: Pixel 7, touch, no hover), signed in as the admin.
const API = process.env.E2E_API_URL ?? "http://localhost:8001/api/v1";
const admin = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };
const learnerEmail = process.env.E2E_LEARNER_EMAIL ?? "";

test.setTimeout(120_000);

const LONG_TITLE = "Vender costo por kilómetro y mantenimiento preventivo a las flotas de carretera";

interface ModuleSeed {
  title: string;
  content_text?: string;
  activities?: { type: string; title: string; spec: unknown }[];
  quiz?: unknown;
}

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

/** A draft course with these modules (their activities published), and the learner assigned to it. */
async function prepareCourse(request: APIRequestContext, title: string, modules: ModuleSeed[]) {
  const call = await adminApi(request);
  const course = await call("post", "/courses", { title, description: "Administrado desde el celular." });
  const created = [];
  for (const seed of modules) {
    const module = await call("post", `/courses/${course.id}/modules`, {
      title: seed.title,
      content_text: seed.content_text ?? "Lo que hay que saber.",
    });
    for (const activity of seed.activities ?? []) {
      await call("post", `/modules/${module.id}/activities`, { ...activity, status: "ready" });
    }
    if (seed.quiz) await call("put", `/modules/${module.id}/evaluation`, seed.quiz);
    created.push(module);
  }
  if (learnerEmail) {
    const [person] = await call("get", `/users?q=${encodeURIComponent(learnerEmail)}`);
    await call("post", `/courses/${course.id}/participants`, { user_ids: [person.id] });
  }
  return { course, modules: created, call };
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

test("la cabecera del curso y la vista previa caben en el celular, con sus actividades para probar", async ({
  page,
  request,
}) => {
  const title = `Celular admin: vista previa ${Date.now()}`;
  const { course } = await prepareCourse(request, title, [
    {
      title: LONG_TITLE,
      content_text: "Cómo presentar el costo por kilómetro a un cliente que solo pregunta el precio.",
      activities: [{ type: "decision", title: "Cliente que solo pide precio", spec: DECISION }],
    },
    { title: "Cierre" },
  ]);
  await page.goto(`/admin/courses/${course.id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 20_000 }); // a cold route

  // A draft keeps "Publicar" in sight, next to the menu, in one row; the rest of the actions are in the menu.
  const publish = page.getByRole("button", { name: "Publicar", exact: true });
  const more = page.getByRole("button", { name: "Más acciones", exact: true });
  await expect(publish).toBeVisible();
  await expect(page.getByRole("link", { name: "Vista previa" })).toBeHidden();
  const middle = async (locator: Locator) => {
    const box = (await locator.boundingBox())!;
    return box.y + box.height / 2;
  };
  expect(Math.abs((await middle(publish)) - (await middle(more)))).toBeLessThan(1);
  await expectTarget(more);
  await more.tap();
  await expect(page.getByRole("menuitem", { name: "Archivar curso" })).toBeVisible();
  await expectTarget(page.getByRole("menuitem", { name: "Eliminar curso" }));
  await page.getByRole("menuitem", { name: "Vista previa" }).tap();

  // The preview is as wide as the phone: a long module title is cut with an ellipsis, not past the edge.
  await expect(page).toHaveURL(new RegExp(`/admin/courses/${course.id}/preview$`));
  await expect(page.getByRole("heading", { level: 2, name: LONG_TITLE })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectWithinWidth(page, page.getByRole("button", { name: new RegExp(LONG_TITLE) }));
  await expectTarget(page.getByRole("link", { name: "Volver al editor" }));

  // The module's activity is there to try, with the admin's preview (nothing is saved).
  await expect(page.getByText("Pruébalas como las jugará tu equipo: nada se guarda.")).toBeVisible();
  const tryIt = page.getByRole("button", { name: "Probar: Cliente que solo pide precio" });
  await expectTarget(tryIt);
  await tryIt.tap();
  const game = page.getByRole("dialog", { name: "Cliente que solo pide precio" });
  await game.getByRole("button", { name: /Empezar/ }).tap();
  await game.getByRole("button", { name: "¿Qué ruta y carga manejan?" }).tap();
  await game.getByRole("button", { name: "Le muestro el costo por kilómetro." }).tap();
  await expect(game.getByRole("button", { name: /Ver resultado/ })).toBeInViewport({ ratio: 1 });
  await expectNoSidewaysScroll(page);
  await game.getByRole("button", { name: /Ver resultado/ }).tap();
  await expect(game.getByRole("status")).toContainText("10 de 10 puntos");
  await game.getByRole("button", { name: "Continuar" }).tap();
  await expect(game).toBeHidden();
  await expect(tryIt).toBeFocused(); // back where the admin was
});

test("participantes y evaluaciones en el celular: «Retirar» a la mano y el título del módulo legible", async ({
  page,
  request,
}) => {
  test.skip(!learnerEmail, "Define E2E_LEARNER_EMAIL para tener a alguien inscrito.");
  const title = `Celular admin: participantes ${Date.now()}`;
  const { course } = await prepareCourse(request, title, [
    {
      title: LONG_TITLE,
      quiz: {
        questions: [{ id: "q1", type: "true_false", prompt: "El costo por kilómetro decide la compra", correct: true }],
        max_attempts: 3,
        passing_score: 70,
      },
    },
  ]);

  // A link straight to a section of the course opens it; on a phone the sections are a list to pick from.
  await page.goto(`/admin/courses/${course.id}?tab=participants`);
  const section = page.getByLabel("Sección del curso");
  await expect(section).toHaveValue("participants", { timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "Participantes" })).toBeHidden();
  await expect(page.getByRole("heading", { level: 2, name: "Participantes" })).toBeVisible();

  // Each person is a card: "Retirar" fits the screen and takes a finger (it asks first).
  const people = page.getByRole("list", { name: "Participantes" });
  const retire = people.getByRole("button", { name: /^Retirar a / });
  await expect(retire).toHaveCount(1);
  await expectWithinWidth(page, retire);
  await expectTarget(retire);
  await expectNoSidewaysScroll(page);
  await retire.tap();
  const confirm = page.getByRole("dialog", { name: /^¿Retirar a / });
  await expect(confirm).toContainText("Se borrará su progreso en este curso.");
  await confirm.getByRole("button", { name: "Cancelar" }).tap();
  await expect(confirm).toBeHidden();
  await expect(retire).toBeVisible();

  // Evaluations, picked from the list: the module's title takes the width, its summary goes under it.
  await section.selectOption("evaluations");
  await expect(page).toHaveURL(/[?&]tab=evaluations/);
  const header = page.getByRole("button", { name: new RegExp(LONG_TITLE), expanded: true });
  const name = header.getByText(LONG_TITLE);
  const summary = header.getByText("1 pregunta · aprueba con 70%");
  await expect(summary).toBeVisible();
  const [headerBox, nameBox, summaryBox] = await Promise.all([header, name, summary].map((part) => part.boundingBox()));
  expect(nameBox!.width).toBeGreaterThan(headerBox!.width / 2);
  expect(summaryBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height - 1);
  await expectNoSidewaysScroll(page);

  // The section is in the address: a reload stays on it.
  await page.reload();
  await expect(section).toHaveValue("evaluations", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: new RegExp(LONG_TITLE), expanded: true })).toBeVisible();
});

test("actividades en el celular: despublicar pide confirmación, flechas para ordenar y el editor sin teclado", async ({
  page,
  request,
}) => {
  const title = `Celular admin: actividades ${Date.now()}`;
  const { course } = await prepareCourse(request, title, [
    {
      title: "Ventas",
      activities: [
        { type: "decision", title: "Cliente que solo pide precio", spec: DECISION },
        { type: "decision", title: "Cliente con prisa", spec: DECISION },
      ],
    },
  ]);
  await page.goto(`/admin/courses/${course.id}?tab=activities`);
  const list = page.getByRole("list", { name: "Actividades de Ventas" });
  const first = list.getByRole("listitem").filter({ hasText: "Cliente que solo pide precio" });
  await expect(first).toContainText("Publicada", { timeout: 20_000 });

  // On a phone the row keeps "Probar" and the arrows; unpublishing and deleting wait in its menu.
  await expectTarget(first.getByRole("button", { name: "Probar" }));
  await expectTarget(first.getByRole("button", { name: "Bajar Cliente que solo pide precio" }));
  await expect(first.getByRole("button", { name: /^Despublicar/ })).toBeHidden();
  await expect(first.getByRole("button", { name: /^Eliminar/ })).toBeHidden();
  const menu = first.getByRole("button", { name: "Más acciones para Cliente que solo pide precio" });
  await expectTarget(menu);
  await expectNoSidewaysScroll(page);

  // Unpublishing asks first (learners waiting only on it complete the module); cancelled, nothing changes.
  await menu.tap();
  await page.getByRole("menuitem", { name: "Despublicar" }).tap();
  const confirm = page.getByRole("dialog", { name: "¿Despublicar «Cliente que solo pide precio»?" });
  await expect(confirm).toContainText("completa el módulo");
  await confirm.getByRole("button", { name: "Cancelar" }).tap();
  await expect(confirm).toBeHidden();
  await expect(first).toContainText("Publicada");
  await menu.tap();
  await page.getByRole("menuitem", { name: "Despublicar" }).tap();
  await confirm.getByRole("button", { name: "Despublicar" }).tap();
  await expect(first).toContainText("Borrador");

  // The arrows reorder with a tap; the focus stays with the activity (at the bottom, on its other arrow).
  await first.getByRole("button", { name: "Bajar Cliente que solo pide precio" }).tap();
  await expect(list.getByRole("listitem").first()).toContainText("Cliente con prisa");
  await expect(page.getByRole("button", { name: "Subir Cliente que solo pide precio" })).toBeFocused();

  // The editor opens without popping the keyboard up; a long option wraps and grows instead of hiding.
  await menu.tap();
  await page.getByRole("menuitem", { name: "Editar" }).tap();
  const editor = page.getByRole("dialog", { name: "Decisión con cliente" });
  await expect(editor).toBeFocused();
  await expect(editor.getByLabel("Título")).not.toBeFocused();
  await expectTarget(editor.getByRole("button", { name: "Cerrar" }));
  const option = editor.getByLabel("Opción 1 de la situación 1");
  const oneLine = (await option.boundingBox())!.height;
  await option.fill("Le doy la más barata, aunque sé que en carretera su costo por kilómetro termina siendo mayor.");
  await option.press("Enter"); // still a single line of text
  await expect(option).toHaveValue(/mayor\.$/);
  await expect.poll(async () => (await option.boundingBox())!.height).toBeGreaterThan(oneLine);
  expect(await option.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);

  // Toasts show at the top on a phone: at the bottom they would cover the panel's buttons.
  await editor.getByLabel("Título").fill("Cliente que pide precio");
  await editor.getByRole("button", { name: "Guardar" }).tap();
  await expect(page.getByText("Actividad guardada")).toBeVisible();
  await expect(page.locator("[data-sonner-toaster]")).toHaveAttribute("data-y-position", "top");
  expect((await page.getByText("Actividad guardada").boundingBox())!.y).toBeLessThan(page.viewportSize()!.height / 3);
});

test("contenido en el celular: módulos con flechas y el motivo de un aviso con un toque", async ({ page, request }) => {
  const title = `Celular admin: contenido ${Date.now()}`;
  const { course, modules } = await prepareCourse(request, title, [
    { title: "Bienvenida" },
    { title: "Seguridad" },
    { title: "Cierre" },
  ]);
  // The second module's video came out with a warning (as the studio reports it).
  const warning = "El presentador no estuvo disponible: el video quedó sin presentador.";
  await page.route(`${API}/courses/${course.id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const detail = await response.json();
    for (const module of detail.modules) if (module.id === modules[1].id) module.video_warning = warning;
    await route.fulfill({ response, json: detail });
  });
  await page.goto(`/admin/courses/${course.id}`);
  const rows = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Reordenar / }) });
  await expect(rows).toHaveCount(3, { timeout: 20_000 });

  // The badge's reason opens with a tap (a tooltip never shows on a touch screen).
  const badge = page.getByRole("button", { name: /^Aviso/ });
  await expect(page.getByText(warning)).toBeHidden();
  await expectTarget(badge);
  await badge.tap();
  await expect(badge).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(warning)).toBeVisible();
  await badge.tap();
  await expect(page.getByText(warning)).toBeHidden();

  // A finger-sized handle to drag, and arrows to move without dragging.
  await expectTarget(page.getByRole("button", { name: "Reordenar Bienvenida" }));
  const down = page.getByRole("button", { name: "Bajar Bienvenida" });
  await expectTarget(down);
  await down.tap();
  await expect(rows.first()).toContainText("Seguridad");
  await expect(rows.nth(1)).toContainText("Bienvenida");
  await expect(down).toBeFocused(); // it moved with its module
  await expectNoSidewaysScroll(page);
});

test("panel, cursos y equipo en el celular", async ({ page, request }) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const name = `Celular Equipo ${stamp}`;
  const person = await call("post", "/users", {
    name,
    email: `celular.${stamp}@local.test`,
    password: "Temporal-2026",
    role: "collaborator",
    position: "Asesora de flotas",
    department: "Ventas",
  });
  const course = await call("post", "/courses", { title: `Celular admin: equipo ${stamp}` });
  await call("post", `/courses/${course.id}/participants`, { user_ids: [person.id] });

  // The panel's figures, two by two: a divider only between the two of each row.
  await page.goto("/admin");
  const figures = page.locator("dl > div");
  await expect(figures).toHaveCount(4, { timeout: 20_000 });
  const divider = (index: number) => figures.nth(index).evaluate((element) => getComputedStyle(element).borderLeftWidth);
  expect(await Promise.all([0, 1, 2, 3].map(divider))).toEqual(["0px", "1px", "0px", "1px"]);

  // The course filters scroll sideways, a fade saying there is more until the end is reached.
  await page.goto("/admin/courses");
  const filters = page.getByRole("group", { name: "Filtrar cursos" });
  const fade = filters.locator("xpath=following-sibling::div[1]");
  await expect.poll(() => fade.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  await filters.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
  await expect.poll(() => fade.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
  await expectTarget(filters.getByRole("button", { name: "Archivados" }));
  await expectNoSidewaysScroll(page);

  // The team on a phone: under each name, the cargo, the área and the courses (the columns that don't fit).
  await page.goto("/admin/team");
  await page.getByLabel("Buscar personas").fill(name);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row.getByText("Asesora de flotas · Ventas")).toBeVisible();
  await expect(row.getByText("0 de 1 curso terminado")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Its sheet: links and the close button take a finger.
  await row.getByRole("button", { name, exact: true }).tap();
  const sheet = page.getByRole("dialog", { name });
  await expectTarget(sheet.getByRole("link", { name: course.title }));
  await expectTarget(sheet.getByRole("button", { name: "Cerrar" }));
});
