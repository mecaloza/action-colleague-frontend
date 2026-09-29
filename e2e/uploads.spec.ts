import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

// Real media files for uploads (FFmpeg must be installed, as it is for the backend).
function makeVideo(): string {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "ac-e2e-")), "clase.mp4");
  execFileSync("ffmpeg", [
    "-nostdin", "-y", "-v", "error",
    "-f", "lavfi", "-i", "testsrc=size=640x480:rate=25",
    "-f", "lavfi", "-i", "sine=frequency=440",
    "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file,
  ]);
  return file;
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function newManualCourse(page: Page, title: string) {
  await page.goto("/admin/courses/new/manual");
  await page.getByLabel("Título del curso").fill(title);
  await page.getByRole("button", { name: /Crear y agregar contenido/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

async function newModule(page: Page, title: string, kind: RegExp) {
  await page.getByRole("button", { name: "Agregar módulo" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Nuevo módulo" });
  await dialog.getByLabel("Título").fill(title);
  await dialog.getByRole("radio", { name: kind }).click();
  await dialog.getByRole("button", { name: "Crear módulo" }).click();
}

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test("subir un video y un documento a un módulo", async ({ page }) => {
  await newManualCourse(page, `Curso con videos ${Date.now()}`);
  await newModule(page, "Bienvenida en video", /Video o documento/);
  const sheet = page.getByRole("dialog", { name: "Bienvenida en video" });

  await sheet.locator('input[type="file"][accept="video/*"]').setInputFiles(makeVideo());
  // Processing happens on the server; the panel shows its steps until the video is ready.
  await expect(sheet.locator("video")).toBeVisible({ timeout: 90_000 });
  await expect(sheet.getByText(/Duración 0:0[12]/)).toBeVisible();

  await sheet.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
    name: "politica.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Usa siempre el casco en la planta."),
  });
  await expect(sheet.getByRole("link", { name: "Ver documento" })).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press("Escape");
  const row = page.getByRole("listitem").filter({ hasText: "Bienvenida en video" });
  await expect(row).toContainText("Video");
  await expect(row).not.toContainText("Sin contenido");
});

test("grabarse con la cámara desde el navegador", async ({ page }) => {
  await newManualCourse(page, `Curso grabado ${Date.now()}`);
  await newModule(page, "Mensaje del gerente", /Grabarme/);

  const studio = page.getByRole("dialog", { name: "Mensaje del gerente" }).last();
  await expect(studio.getByRole("button", { name: "Grabar" })).toBeEnabled({ timeout: 15_000 });
  await studio.getByRole("button", { name: "Grabar" }).click();
  await expect(studio.getByText(/Grabando/)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2_500); // let the fake camera record a couple of seconds
  await studio.getByRole("button", { name: "Terminar" }).click();
  await studio.getByRole("button", { name: "Usar esta grabación" }).click();

  await expect(page.getByText(/Grabación subida/)).toBeVisible({ timeout: 60_000 });
  const sheet = page.getByRole("dialog", { name: "Mensaje del gerente" });
  await expect(sheet.locator("video")).toBeVisible({ timeout: 90_000 });
});

test("subir una portada al curso", async ({ page }) => {
  await newManualCourse(page, `Curso con portada ${Date.now()}`);
  await page.getByRole("tab", { name: "Ajustes" }).click();
  await page.locator('input[type="file"][accept^="image/"]').setInputFiles({ name: "portada.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByText("Portada actualizada")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: "Portada actual" })).toBeVisible();
});
