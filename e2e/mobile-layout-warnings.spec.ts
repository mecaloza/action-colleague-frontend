import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { API, adminApi } from "./fixtures/api";

// The script's layout warnings on a phone ("mobile" project: Pixel 7, touch, no hover), at the narrowest width we
// support. Fake providers: the slides are checked with the renderer the videos use.
test.setTimeout(120_000);
test.use({ viewport: { width: 360, height: 740 } });

/** The longest point a slide accepts: not even its smallest size fits it on a bullets slide. */
const LONG_POINT = "Usar siempre el equipo de protección personal completo antes de entrar a la zona de producción "
  .repeat(4)
  .slice(0, 300);
const TOO_LONG = "La viñeta 2 no cabe y se corta. Usa un texto más corto.";
const SCENES = [
  {
    id: "s1",
    slide: { layout: "cover", title: "Seguridad en planta", subtitle: "Lo esencial" },
    narration: "Bienvenida al módulo sobre el uso correcto del casco en la planta.",
  },
  {
    id: "s2",
    slide: { layout: "bullets", title: "Reglas del casco", points: ["Siempre puesto", LONG_POINT] },
    narration: "Hay dos reglas: llevarlo siempre puesto y revisarlo antes de cada turno.",
  },
];
const VIDEO = { url: "https://example.com/video.mp4", mime_type: "video/mp4", duration_seconds: 60, width: 1280, height: 720 };

/** Big enough for a finger (polled: the page may still be settling). */
async function expectTarget(locator: Locator, min = 40) {
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return box ? Math.min(box.width, box.height) : 0;
    })
    .toBeGreaterThanOrEqual(min);
}

/** Nothing is wider than the phone: the page doesn't scroll sideways. */
async function expectNoSidewaysScroll(page: Page) {
  const width = page.viewportSize()!.width;
  await expect
    .poll(() => page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: window.innerWidth })))
    .toEqual({ page: width, viewport: width });
}

/** Inside the screen from side to side (it may still be further down the page). */
async function expectWithinWidth(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
}

async function scriptedCourse(request: APIRequestContext) {
  const call = await adminApi(request);
  const course = await call<{ id: number }>("post", "/courses", {
    title: `Avisos de diseño en el celular ${Date.now()}`,
    source: "ai",
  });
  const module = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: "Uso del casco en la planta de producción",
    source: "ai",
  });
  await call("put", `/modules/${module.id}/storyboard`, { scenes: SCENES });
  return course.id;
}

const scene = (page: Page, number: number) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByLabel(`Diseño de la escena ${number}`, { exact: true }) })
    .last();

test("los avisos del guion caben en el celular y llevan con un toque al punto que no cabe", async ({ page, request }) => {
  const courseId = await scriptedCourse(request);
  await page.goto(`/admin/courses/${courseId}/studio`);
  await page.getByRole("navigation", { name: "Pasos del estudio" }).getByRole("button", { name: /Contenido/ }).tap();
  await page.getByRole("button", { name: /Revisar guion/ }).tap();

  const summary = page.getByRole("region", { name: "Avisos de diseño" });
  await expect(summary).toContainText("1 escena con un texto que no cabe");
  await expectNoSidewaysScroll(page);
  const badge = scene(page, 2).getByText("1 aviso de diseño");
  await expect(badge).toBeVisible();
  await expectWithinWidth(page, badge);

  const jump = summary.getByRole("button", { name: "Escena 02" });
  await expectTarget(jump);
  await jump.tap();
  const point = scene(page, 2).getByRole("textbox", { name: "Viñetas 2", exact: true });
  await expect(point).toBeFocused();
  await expect(point).toBeInViewport();
  const message = scene(page, 2).getByText(TOO_LONG);
  await expect(message).toBeVisible();
  await expectWithinWidth(page, message);
});

test("en producción, los avisos de cada módulo se leen y se corrigen desde el celular", async ({ page, request }) => {
  const courseId = await scriptedCourse(request);
  // The module has its video: the studio opens on Producción.
  await page.route(`${API}/courses/${courseId}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const detail = await response.json();
    for (const module of detail.modules) Object.assign(module, { video: VIDEO, duration_seconds: 60 });
    await route.fulfill({ response, json: detail });
  });
  await page.goto(`/admin/courses/${courseId}/studio`);
  await expect(page.getByRole("heading", { name: "Tu curso está producido." })).toBeVisible();

  const row = page.getByRole("listitem").filter({ hasText: "Uso del casco en la planta de producción" });
  await expect(row).toContainText("Avisos de diseño: 1 escena con un texto que no cabe.");
  const details = row.getByRole("button", { name: "Ver avisos" });
  await expectTarget(details);
  await details.tap();
  await expectWithinWidth(page, row.getByText(TOO_LONG));
  await expectNoSidewaysScroll(page);

  const fix = row.getByRole("button", { name: /Corregir en el guion/ });
  await expectTarget(fix);
  await fix.tap();
  await expect(page.getByRole("heading", { name: "Guiones y diapositivas" })).toBeVisible();
  await expect(scene(page, 2).getByText(TOO_LONG)).toBeVisible();
});
