import { test, expect, type Locator, type Page } from "@playwright/test";
import { adminApi } from "./fixtures/api";
import {
  ACTIVITY_TITLE,
  addActivity,
  MODULE_TITLE as QUIZ_MODULE,
  quizCourse,
  savedActivity,
  savedQuestions,
} from "./fixtures/revisions";
import { MODULE_TITLE, sceneTitles, scriptedCourse } from "./fixtures/scripts";

// "Pedir un cambio" to a module's script, its quiz and its activities on a phone ("mobile" project: Pixel 7, touch,
// no hover), at the narrowest width we support. Fake providers: the AI's change is deterministic (see
// fixtures/scripts.ts and fixtures/revisions.ts).
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

/** The page itself never scrolls sideways (its new buttons wrap instead). */
async function expectNoSidewaysPage(page: Page) {
  const width = page.viewportSize()!.width;
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
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

test("en el celular se pide un cambio a una pregunta y a una actividad, y se revisa sin desbordes", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await quizCourse(call, "Evaluación y actividad desde el celular");
  const activity = await addActivity(call, moduleId);
  await page.goto(`/admin/courses/${courseId}?tab=evaluations`);

  // A question's own button: only its icon on a phone, big enough for a finger.
  const ask = page.getByRole("button", { name: "Pedir un cambio en la pregunta 2" });
  await expectTarget(ask);
  await expectTarget(page.getByRole("button", { name: "Pedir un cambio", exact: true }));
  await expectNoSidewaysPage(page);
  await ask.tap();
  const quizSheet = page.getByRole("dialog", { name: "Cambios a la evaluación" });
  const field = quizSheet.getByLabel("¿Qué quieres cambiar?");
  await expect(field).toBeVisible();
  await expect(field).not.toBeFocused(); // the keyboard doesn't pop up over the panel
  const second = quizSheet.getByRole("button", { name: "Pregunta 02 · ¿Cuándo se revisa el casco?" });
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expectTarget(second);
  await expectFits(page, quizSheet);
  await field.fill("La pregunta no dice de qué revisión se trata.");
  const propose = quizSheet.getByRole("button", { name: "Pedir propuesta" });
  await expect(propose).toBeInViewport();
  await propose.tap();

  // The proposal: the question before and after, stacked; the decision always at hand at the bottom.
  await expect(quizSheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeVisible({ timeout: 60_000 });
  await expect(
    quizSheet.getByRole("listitem", { name: "Pregunta 2: Revisado: ¿Cuándo se revisa el casco?" }),
  ).toBeVisible();
  const apply = quizSheet.getByRole("button", { name: "Aplicar", exact: true });
  for (const action of [
    apply,
    quizSheet.getByRole("button", { name: "Pedir otro ajuste" }),
    quizSheet.getByRole("button", { name: "Descartar" }),
  ]) {
    await expect(action).toBeInViewport();
    await expectTarget(action);
  }
  const reach = quizSheet.getByRole("region", { name: "Para las personas" });
  await reach.scrollIntoViewIfNeeded();
  await expect(reach).toBeInViewport();
  await expectFits(page, quizSheet);
  await apply.tap();
  await expect(quizSheet).toBeHidden();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Cambio aplicado" })).toBeVisible();
  expect((await savedQuestions(call, moduleId))[1].prompt).toBe("Revisado: ¿Cuándo se revisa el casco?");

  // An activity, from its row's menu.
  await page.getByLabel("Sección del curso").selectOption("activities");
  const row = page
    .getByRole("list", { name: `Actividades de ${QUIZ_MODULE}` })
    .getByRole("listitem")
    .filter({ hasText: ACTIVITY_TITLE });
  const menu = row.getByRole("button", { name: `Más acciones para ${ACTIVITY_TITLE}` });
  await expectTarget(menu);
  await expectNoSidewaysPage(page);
  await menu.tap();
  const item = page.getByRole("menuitem", { name: "Pedir un cambio" });
  await expectTarget(item);
  await item.tap();
  const activitySheet = page.getByRole("dialog", { name: "Cambios a la actividad" });
  const observation = activitySheet.getByLabel("¿Qué quieres cambiar?");
  await expect(observation).toBeVisible();
  await expect(observation).not.toBeFocused();
  await expectFits(page, activitySheet);
  await observation.fill("Que las consecuencias hablen del costo.");
  await activitySheet.getByRole("button", { name: "Pedir propuesta" }).tap();
  await expect(activitySheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeVisible({ timeout: 60_000 });
  const choice = activitySheet.getByRole("listitem", { name: "Opción 1 de la situación 1" });
  await choice.scrollIntoViewIfNeeded();
  await expect(choice).toContainText("Vendes hoy, pero el costo por kilómetro sube. Revisado.");
  await expectFits(page, activitySheet);
  const applyActivity = activitySheet.getByRole("button", { name: "Aplicar", exact: true });
  await expect(applyActivity).toBeInViewport();
  await expectTarget(applyActivity);
  await applyActivity.tap();
  await expect(activitySheet).toBeHidden();
  // Its own toast (the quiz's may still be there): the activity is published, its new lines are voiced.
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "La voz de las líneas nuevas se está grabando." }),
  ).toBeVisible();
  expect((await savedActivity(call, moduleId, activity.id)).intro).toMatch(/^Revisado: /);
});
