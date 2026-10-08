import { test, expect, type Locator, type Page } from "@playwright/test";
import { adminApi, learnerApi, newLearner, PASSWORD, publishedCourse } from "./fixtures/api";

// Certificates on a phone ("mobile" project: Pixel 7, touch, no hover), at the narrowest width we support.
test.setTimeout(120_000);
test.use({ viewport: { width: 360, height: 740 } });

const CODE = /RC-[0-9A-Z]{4}-[0-9A-Z]{4}/;

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

  test("el certificado en el celular: al completar, en su perfil y en la verificación pública", async ({ page, request }) => {
    const call = await adminApi(request);
    const stamp = Date.now();
    // Long names and titles: they wrap, they never widen the page.
    const course = await publishedCourse(call, `Presión, desgaste y rotación de llantas en las unidades de arrastre ${stamp}`);
    const learner = await newLearner(call, `María Fernanda de los Ángeles Castañeda ${stamp}`);
    await call("post", `/courses/${course.id}/participants`, { user_ids: [learner.id] });

    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(learner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /Ingresar/ }).tap();
    await expect(page).toHaveURL(/\/learn$/, { timeout: 20_000 }); // a cold route

    // Completing it: the celebration fits, with the certificate's links at hand.
    await page.goto(`/learn/${course.id}`);
    await page.getByRole("button", { name: /Marcar como completado/ }).tap();
    const dialog = page.getByRole("dialog", { name: "¡Completaste el curso!" });
    const download = dialog.getByRole("link", { name: "Descargar certificado", exact: true });
    await download.scrollIntoViewIfNeeded();
    await expect(download).toBeInViewport({ ratio: 1 });
    await expectTarget(download);
    await expectTarget(dialog.getByRole("link", { name: "Ver verificación" }));
    await expectNoSidewaysScroll(page);
    const code = (await download.getAttribute("href"))!.match(CODE)![0];
    await dialog.getByRole("button", { name: "Repasar el curso" }).tap();
    await expect(dialog).toBeHidden();

    // "Mis certificados" in the profile.
    await page.goto("/profile");
    const mine = page.getByRole("list", { name: "Mis certificados" }).getByRole("listitem").filter({ hasText: code });
    await expect(mine).toContainText("Válido");
    const save = mine.getByRole("link", { name: `Descargar certificado «${course.title}»` });
    await expectTarget(save);
    await expectWithinWidth(page, save);
    const verify = mine.getByRole("link", { name: `Ver verificación «${course.title}»` });
    await expectTarget(verify);
    await expectWithinWidth(page, verify);
    await expectNoSidewaysScroll(page);

    // The public verification (no session needed: this one is the learner's, it would read the same).
    await page.goto(`/verify/${code}`);
    await expect(page.getByRole("heading", { level: 1, name: "Certificado válido" })).toBeVisible();
    const pdf = page.getByRole("article", { name: "Datos del certificado" }).getByRole("link", { name: "Descargar certificado" });
    await pdf.scrollIntoViewIfNeeded();
    await expectTarget(pdf);
    await expectWithinWidth(page, pdf);
    await expectNoSidewaysScroll(page);
    // Not found: the form to try another code fits too.
    await page.goto("/verify/RC-0000-0000");
    await expect(page.getByRole("heading", { level: 1, name: "Certificado no encontrado" })).toBeVisible();
    await expectTarget(page.getByRole("button", { name: "Verificar" }));
    await expectNoSidewaysScroll(page);
  });
});

test("el registro de certificados y los Parámetros en el celular caben y se usan con el dedo", async ({ page, request }) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const course = await publishedCourse(call, `Mantenimiento preventivo de flotas de carretera ${stamp}`);
  const learner = await newLearner(call, `Persona con un nombre bastante largo ${stamp}`);
  await call("post", `/courses/${course.id}/participants`, { user_ids: [learner.id] });
  // The learner completes it through the API: its certificate is issued.
  const learnerCall = await learnerApi(request, learner.email);
  const detail = await learnerCall<{ modules: { id: number }[] }>("get", `/learn/courses/${course.id}`);
  const done = await learnerCall<{ certificate: { code: string } | null }>("post", `/learn/modules/${detail.modules[0].id}/complete`);
  const code = done.certificate!.code;

  // The registry: cards, their menu within reach.
  await page.goto("/admin/certificates");
  await page.getByLabel("Buscar certificados").fill(code);
  const card = page.getByRole("list", { name: "Certificados" }).getByRole("listitem").filter({ hasText: code });
  await expect(card).toContainText(course.title, { timeout: 20_000 }); // a cold route
  const menu = card.getByRole("button", { name: `Acciones del certificado ${code} de ${learner.name}` });
  await expectTarget(menu);
  await expectWithinWidth(page, menu);
  await expectNoSidewaysScroll(page);
  await menu.tap();
  await expectTarget(page.getByRole("menuitem", { name: "Revocar" }));
  await page.keyboard.press("Escape");
  // Issuing by hand opens without the keyboard, and fits.
  await page.getByRole("button", { name: "Emitir certificado" }).first().tap();
  const issue = page.getByRole("dialog", { name: "Emitir certificado" });
  await expect(issue).toBeFocused();
  await expectNoSidewaysScroll(page);
  await issue.getByRole("button", { name: "Cancelar" }).tap();
  await expect(issue).toBeHidden();

  // Parámetros: the miniature keeps to the screen and the save bar stays in sight.
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Parámetros" })).toBeVisible();
  const preview = page.getByRole("figure");
  await preview.scrollIntoViewIfNeeded();
  await expectWithinWidth(page, preview);
  const saveButton = page.getByRole("button", { name: "Guardar cambios" });
  await expect(saveButton).toBeInViewport();
  await expectTarget(saveButton);
  await expectNoSidewaysScroll(page);
});
