import { test, expect, type Locator, type Page } from "@playwright/test";
import { adminApi } from "./fixtures/api";
import { MODULE_TITLE, sceneTitles, scriptedCourse } from "./fixtures/scripts";

// "Pedir un cambio" to a module's script on a phone ("mobile" project: Pixel 7, touch, no hover), at the narrowest
// width we support. Fake providers: the AI's change is deterministic (see fixtures/scripts.ts).
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

/** Nothing in the panel is wider than the phone, and nothing in it scrolls sideways. */
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

test("en el celular se pide un cambio al guion desde el panel del módulo, se revisa y se aplica", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await scriptedCourse(call, "Cambios desde el celular");
  await page.goto(`/admin/courses/${courseId}`);

  // On a phone the title opens the module's panel, which offers the change.
  await page.getByRole("button", { name: new RegExp(`^${MODULE_TITLE}`) }).tap();
  const modulePanel = page.getByRole("dialog", { name: MODULE_TITLE });
  const ask = modulePanel.getByRole("button", { name: "Pedir un cambio" });
  await expectTarget(ask);
  await ask.tap();

  // Over it, the change's own panel, the width of the phone.
  const sheet = page.getByRole("dialog", { name: "Cambios al guion" });
  const field = sheet.getByLabel("¿Qué quieres cambiar?");
  await expect(field).toBeVisible();
  await expect(field).not.toBeFocused(); // the keyboard doesn't pop up over the panel
  const second = sheet.getByRole("button", { name: "Escena 02 · Reglas del casco" });
  await expectTarget(second);
  await second.tap();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expectTarget(sheet.getByRole("button", { name: /Usar el ejemplo: Acorta la narración/ }));
  await expectFits(page, sheet);
  await field.fill("El título no se entiende y la narración debe nombrar los dos puntos.");
  const propose = sheet.getByRole("button", { name: "Pedir propuesta" });
  await expect(propose).toBeInViewport();
  await expectTarget(propose);
  await propose.tap();

  // The proposal: scene 2 before and after, stacked; the decision always at hand at the bottom.
  await expect(sheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeVisible({ timeout: 60_000 });
  const card = sheet.getByRole("listitem", { name: "Escena 2: Revisado: Reglas del casco" });
  // The slides are drawn as they come into sight (one above the other on a phone).
  for (const [when, alt] of [
    ["Antes", "Escena 2 antes del cambio"],
    ["Después", "Escena 2 con el cambio"],
  ]) {
    await card.getByText(when, { exact: true }).first().scrollIntoViewIfNeeded();
    await expect(card.getByRole("img", { name: alt })).toBeVisible({ timeout: 30_000 });
  }
  await expect(card.locator("ins")).toContainText("Revisa este punto con cuidado.");
  const apply = sheet.getByRole("button", { name: "Aplicar", exact: true });
  const another = sheet.getByRole("button", { name: "Pedir otro ajuste" });
  for (const action of [apply, another, sheet.getByRole("button", { name: "Descartar" })]) {
    await expect(action).toBeInViewport();
    await expectTarget(action);
  }
  await expectFits(page, sheet);
  await sheet.getByRole("region", { name: "Para el video" }).scrollIntoViewIfNeeded();
  await expect(sheet.getByRole("region", { name: "Para el video" })).toBeInViewport();
  await expect(apply).toBeInViewport();

  // Applied: back on the module's panel, the toast at the top, clear of the panel's buttons.
  await apply.tap();
  await expect(sheet).toBeHidden();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Cambio aplicado" })).toBeVisible();
  await expect(page.locator("[data-sonner-toaster]")).toHaveAttribute("data-y-position", "top");
  await expect(modulePanel).toBeVisible();
  expect(await sceneTitles(call, moduleId)).toEqual(["Seguridad en planta", "Revisado: Reglas del casco", "Para recordar"]);

  // The history from the module's panel: the change, with «Deshacer» at hand.
  await modulePanel.getByRole("button", { name: "Historial de cambios" }).tap();
  const history = sheet.getByRole("list", { name: "Cambios del guion" }).getByRole("listitem");
  await expect(history.first()).toContainText("Cambio pedido a la IA");
  const undo = history.first().getByRole("button", { name: /^Deshacer/ });
  await expectTarget(undo);
  await expectFits(page, sheet);
  await undo.tap();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Cambio deshecho" })).toBeVisible();
  expect(await sceneTitles(call, moduleId)).toEqual(["Seguridad en planta", "Reglas del casco", "Para recordar"]);
});
