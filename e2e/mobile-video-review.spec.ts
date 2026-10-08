import { test, expect, type Locator, type Page } from "@playwright/test";
import { adminApi } from "./fixtures/api";
import { BLACK, CUT, CUT_FIX, fakeReview, fakeReviews } from "./fixtures/reviews";
import { MODULE_TITLE, scriptedCourse } from "./fixtures/scripts";

// The review of a module's AI video ("Revisión de calidad") on a phone ("mobile" project: Pixel 7, touch, no hover),
// at the narrowest width we support. The review is faked in the browser (see fixtures/reviews.ts).
test.setTimeout(120_000);
test.use({ viewport: { width: 360, height: 740 } });

/** Big enough for a finger (polled: a panel sliding in is elsewhere for a moment). */
async function expectTarget(locator: Locator, min = 40) {
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return box ? Math.min(box.width, box.height) : 0;
    })
    .toBeGreaterThanOrEqual(min);
}

/** Nothing in it is wider than the phone, and nothing in it scrolls sideways. */
async function expectFits(page: Page, panel: Locator) {
  const width = page.viewportSize()!.width;
  await expect
    .poll(() =>
      panel.evaluate((root, screen) => {
        const wide = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))].filter((element) => {
          const box = element.getBoundingClientRect();
          // Visually hidden texts are 1px boxes: they never show.
          const shown = box.width > 1 && box.height > 1;
          return shown && (box.left < -0.5 || box.right > screen + 0.5 || element.scrollWidth > element.clientWidth + 1);
        });
        return wide.map((element) => `${element.tagName}.${element.className}`.slice(0, 80));
      }, width),
    )
    .toEqual([]);
}

/** The page itself never scrolls sideways. */
async function expectNoSidewaysPage(page: Page) {
  const width = page.viewportSize()!.width;
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
}

test("en el celular, la revisión de calidad se abre con el dedo, sus fotogramas van de dos en dos y «Corregir» pide el cambio", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Revisión en el celular");
  await fakeReviews(page, courseId, moduleId, fakeReview(901, moduleId));
  await page.goto(`/admin/courses/${courseId}`);

  // The module's chip: a tap opens what it found (never a tooltip).
  const chip = page.getByRole("button", { name: /^Revisión de calidad de / });
  await expect(chip).toContainText("1 crítico");
  await expect(chip).toHaveAccessibleName(
    `Revisión de calidad de ${MODULE_TITLE}: Quedan 3 hallazgos por revisar, 1 de ellos crítico.`,
  );
  await expectTarget(chip);
  await chip.tap();
  const popover = page.getByRole("menu");
  await expect(popover).toContainText("Quedan 3 hallazgos por revisar, 1 de ellos crítico.");
  await expectFits(page, popover);
  const open = popover.getByRole("menuitem", { name: "Ver la revisión" });
  await expectTarget(open);
  await open.tap();

  // The review, the width of the phone.
  const sheet = page.getByRole("dialog", { name: "Revisión de calidad" });
  await expect(sheet.getByRole("heading", { name: "Hay problemas por corregir" })).toBeVisible();
  await expectFits(page, sheet);
  await expectNoSidewaysPage(page);
  const cut = sheet.getByRole("listitem", { name: CUT });
  for (const action of ["Corregir", "Ver en el video", "Ignorar"]) await expectTarget(cut.getByRole("button", { name: action }));
  const black = sheet.getByRole("listitem", { name: BLACK });
  await expectTarget(black.getByRole("button", { name: "Ignorar" }));

  // Its frames, two side by side.
  const frames = sheet.getByRole("region", { name: /^Fotogramas revisados/ }).getByRole("button");
  await frames.nth(2).scrollIntoViewIfNeeded();
  const [first, second, third] = await Promise.all([0, 1, 2].map((index) => frames.nth(index).boundingBox()));
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(1);
  expect(second!.x).toBeGreaterThan(first!.x + first!.width - 1);
  expect(third!.y).toBeGreaterThan(first!.y + first!.height - 1);
  expect(first!.width).toBeGreaterThan(120);

  // A frame enlarged fits the screen, with what was found drawn over it; the next one, a tap away.
  await frames.nth(3).tap();
  const enlarged = page.getByRole("dialog", { name: "Escena 02 · 0:06" });
  await expect(enlarged.locator("[data-qa-box]")).toHaveCount(1);
  await expectFits(page, enlarged);
  const next = enlarged.getByRole("button", { name: "Fotograma siguiente" });
  await expectTarget(next);
  await next.tap();
  await expect(page.getByRole("dialog", { name: "Escena 02 · 0:07" })).toBeVisible();
  await page.getByRole("dialog", { name: "Escena 02 · 0:07" }).getByRole("button", { name: "Cerrar" }).tap();
  await expect(page.getByRole("dialog", { name: /^Escena 02 ·/ })).toBeHidden();

  // «Corregir»: the change's own panel over it, with what the review suggests (the keyboard stays down).
  await cut.getByRole("button", { name: "Corregir" }).tap();
  const change = page.getByRole("dialog", { name: "Cambios al guion" });
  const field = change.getByLabel("¿Qué quieres cambiar?");
  await expect(field).toHaveValue(CUT_FIX);
  await expect(field).not.toBeFocused();
  await expect(change.getByRole("button", { name: "Escena 02 · Reglas del casco" })).toHaveAttribute("aria-pressed", "true");
  await expectFits(page, change);
  const propose = change.getByRole("button", { name: "Pedir propuesta" });
  await expect(propose).toBeInViewport();
  await expectTarget(propose);
  await change.getByRole("button", { name: "Cerrar" }).tap();
  await expect(change).toBeHidden();

  // Ignored with the finger: the same place opens it again.
  await black.getByRole("button", { name: "Ignorar" }).tap();
  await expect(black).toContainText("Ignorado");
  await expectTarget(black.getByRole("button", { name: "Reabrir" }));
  const again = sheet.getByRole("button", { name: "Revisar de nuevo" });
  await expect(again).toBeInViewport();
  await expectTarget(again);

  // Parámetros: the section keeps to the screen, its switches are whole rows (a finger needs more than the switch).
  await page.goto("/admin/settings");
  const qa = page.getByRole("region", { name: "Revisión de calidad" });
  await qa.scrollIntoViewIfNeeded();
  const section = (await qa.boundingBox())!;
  expect(section.x).toBeGreaterThanOrEqual(0);
  expect(section.x + section.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  for (const row of ["settings-qa-auto", "settings-qa-block"]) {
    const label = page.locator(`label[for="${row}"]`);
    await expectTarget(label);
    const box = (await label.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await expectNoSidewaysPage(page);
});
