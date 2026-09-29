import { test, expect } from "@playwright/test";

// Runs against a backend with USE_FAKE_PROVIDERS=true: deterministic AI, voice and presenter.
test.setTimeout(240_000);

test("un admin crea un curso con IA de principio a fin", async ({ page }) => {
  await page.goto("/admin/courses/new");
  await page.getByRole("link", { name: /Crear con IA/ }).click();
  await expect(page).toHaveURL(/\/admin\/courses\/new\/ai$/);

  // 01 Brief
  await page.getByLabel("¿Qué deben aprender?").fill(
    "Seguridad en la planta para operarios nuevos: uso del casco, guantes y cómo reportar un incidente.",
  );
  await page.getByLabel("¿Para quién es?").fill("Operarios nuevos");
  await page.getByRole("button", { name: "2", exact: true }).click(); // two modules
  await page.locator('input[type="file"]').setInputFiles({
    name: "manual.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("El casco es obligatorio en toda la planta. Los incidentes se reportan el mismo día."),
  });
  await expect(page.getByText("manual.txt")).toBeVisible();
  await page.getByRole("button", { name: /Proponer estructura/ }).click();

  // 02 Structure: the AI's proposal, editable
  await expect(page).toHaveURL(/\/admin\/courses\/\d+\/studio$/, { timeout: 60_000 });
  const courseTitle = page.getByLabel("Título del curso");
  await expect(courseTitle).toHaveValue(/Curso de seguridad/i, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /^Quitar módulo \d+$/ })).toHaveCount(2);
  await courseTitle.fill("Seguridad en planta");
  await page.getByRole("button", { name: /Aprobar y escribir guiones/ }).click();

  // 03 Content: scripts written in the background, then reviewed and edited
  await expect(page.getByRole("heading", { name: "Guiones y diapositivas" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Revisar guion/ })).toHaveCount(2, { timeout: 90_000 });
  await page.getByRole("button", { name: /Revisar guion/ }).first().click();
  const narration = page.getByLabel("Narración").first();
  await narration.fill("Bienvenidos. En este módulo veremos por qué el casco es obligatorio.");
  await expect(page.getByRole("img", { name: "Diapositiva de la escena 1" })).toBeVisible();
  await page.getByRole("button", { name: /Guardar guion/ }).click();
  await expect(page.getByText("Guion guardado")).toBeVisible();
  await page.getByRole("button", { name: /Elegir voz y estilo/ }).click();

  // 04 Style and voice
  await page.getByRole("button", { name: /Voz de prueba/ }).click();
  await page.getByRole("button", { name: /Presentadora de prueba/ }).click();
  await page.getByRole("button", { name: "Claro" }).click();
  await page.getByRole("button", { name: /Producir 2 videos/ }).click();

  // 05 Production
  await expect(page.getByRole("heading", { name: "Tu curso está producido." })).toBeVisible({ timeout: 180_000 });
  await page.getByRole("button", { name: /Ver el video de/ }).first().click();
  await expect(page.getByRole("dialog").locator("video")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: /Revisar y publicar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Seguridad en planta" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Estudio IA/ })).toBeVisible();
});
