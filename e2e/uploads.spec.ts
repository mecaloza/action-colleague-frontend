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

/** Adds a "Grabarme" module and opens its studio on camera only, ready to record. */
async function openCameraStudio(page: Page, title: string) {
  await newModule(page, title, /Grabarme/);
  const studio = page.getByRole("dialog", { name: title }).last();
  await studio.getByRole("button", { name: /Solo cámara/ }).click();
  await expect(studio.getByRole("button", { name: "Grabar" })).toBeEnabled({ timeout: 15_000 });
  return studio;
}

test("grabarse con la cámara desde el navegador", async ({ page }) => {
  await newManualCourse(page, `Curso grabado ${Date.now()}`);
  const studio = await openCameraStudio(page, "Mensaje del gerente");
  await studio.getByRole("button", { name: "Grabar" }).click();
  await expect(studio.getByText(/Grabando/)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2_500); // let the fake camera record a couple of seconds
  await studio.getByRole("button", { name: "Terminar" }).click();
  await studio.getByRole("button", { name: "Usar esta grabación" }).click();

  await expect(page.getByText(/Grabación subida/)).toBeVisible({ timeout: 60_000 });
  const sheet = page.getByRole("dialog", { name: "Mensaje del gerente" });
  await expect(sheet.locator("video")).toBeVisible({ timeout: 90_000 });
});

/** A small real PDF, one page per text (the server renders each page as a slide). */
function makePdf(pages: string[]): Buffer {
  // Objects 1 to 3 are the catalog, the page tree and the font; each page is then an object followed by its content.
  const pageObject = (i: number) => 4 + i * 2;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObject(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pages.forEach((text, i) => {
    const literal = text.replace(/[\\()]/g, "\\$&"); // a PDF string ends at an unescaped ")"
    const stream = `BT /F1 48 Tf 72 300 Td (${literal}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageObject(i) + 1} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  const entries = objects.length + 1; // the free entry 0 counts too
  pdf += `xref\n0 ${entries}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${entries} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/** The uploads the page starts (one POST per file sent), to check what is uploaded again and what is not. */
function trackUploads(page: Page): string[] {
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/media/uploads")) uploads.push(request.url());
  });
  return uploads;
}

interface ComposeRequest {
  recording_asset_id: string;
  timeline: { at: number; slide: number }[];
}

/** Answers the first request to combine a recording with an error, lets the next ones through and keeps every body. */
async function failFirstCompose(page: Page, status: number, detail: unknown): Promise<ComposeRequest[]> {
  const requests: ComposeRequest[] = [];
  await page.route("**/modules/*/recording", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requests.push(route.request().postDataJSON());
    if (requests.length > 1) return route.continue();
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ detail }),
    });
  });
  return requests;
}

test("grabarse con las diapositivas de un PDF", async ({ page }) => {
  test.slow(); // the server processes the PDF and then combines it with the take
  const uploads = trackUploads(page);
  // The first request to combine fails: trying again must reuse the recording already uploaded.
  const composes = await failFirstCompose(page, 500, "Error interno");
  await newManualCourse(page, `Curso con diapositivas ${Date.now()}`);
  await newModule(page, "Presentación de seguridad", /Grabarme/);

  const studio = page.getByRole("dialog", { name: "Presentación de seguridad" }).last();
  await studio.getByRole("button", { name: /Cámara y diapositivas/ }).click();
  await studio.locator('input[type="file"]').setInputFiles({
    name: "diapositivas.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(["Uno: el casco (siempre)", "Dos: los guantes \\ las gafas"]),
  });
  await expect(studio.getByRole("img", { name: /^Diapositiva 1\b/ })).toBeVisible({ timeout: 60_000 });

  await expect(studio.getByRole("button", { name: "Grabar" })).toBeEnabled({ timeout: 15_000 });
  await studio.getByRole("button", { name: "Grabar" }).click();
  await expect(studio.getByText(/Grabando/)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_000);
  await studio.getByRole("button", { name: "Diapositiva siguiente" }).click();
  await expect(studio.getByRole("img", { name: /^Diapositiva 2\b/ })).toBeVisible();
  await page.waitForTimeout(1_000);
  // The keyboard too, as a presentation clicker would.
  await page.keyboard.press("ArrowLeft");
  await expect(studio.getByRole("img", { name: /^Diapositiva 1\b/ })).toBeVisible();
  await page.waitForTimeout(1_000);
  await page.keyboard.press("ArrowRight");
  await expect(studio.getByRole("img", { name: /^Diapositiva 2\b/ })).toBeVisible();
  await page.waitForTimeout(1_000);
  await studio.getByRole("button", { name: "Terminar" }).click();
  await studio.getByRole("button", { name: "Usar esta grabación" }).click();

  // The failure shows under the studio; the second try sends the same take without uploading it again.
  await expect(studio.getByRole("alert")).toContainText("El servidor tuvo un problema", { timeout: 60_000 });
  const uploadsBeforeRetry = uploads.length;
  await studio.getByRole("button", { name: "Usar esta grabación" }).click();
  await expect(page.getByText(/combinándola con tus diapositivas/)).toBeVisible({ timeout: 60_000 });
  expect(uploads).toHaveLength(uploadsBeforeRetry);
  expect(uploads).toHaveLength(2); // the deck and the recording, once each
  expect(composes).toHaveLength(2);
  expect(composes[1]).toEqual(composes[0]);
  expect(composes[1].timeline[0]).toEqual({ at: 0, slide: 0 });
  expect(composes[1].timeline.some((point) => point.slide === 1)).toBe(true);

  const sheet = page.getByRole("dialog", { name: "Presentación de seguridad" });
  await expect(sheet.locator("video")).toBeVisible({ timeout: 120_000 });
});

test("si las diapositivas llegan sin páginas o el servidor perdió la grabación, el estudio se recupera", async ({ page }) => {
  test.slow(); // the server processes the PDF and then combines it with the take
  const uploads = trackUploads(page);
  // The deck's first "ready" answer comes without its page images (e.g. they could not be signed).
  let emptied = false;
  await page.route(
    (url) => /\/media\/[0-9a-f-]{36}$/.test(url.pathname),
    async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const asset = await response.json();
      const empty = !emptied && asset.kind === "deck" && asset.status === "ready";
      if (empty) emptied = true;
      await route.fulfill({
        status: response.status(),
        headers: { "access-control-allow-origin": "*" },
        json: empty ? { ...asset, pages: [] } : asset,
      });
    },
  );
  // The first request to combine finds the recording lost: the next try must upload it again.
  const composes = await failFirstCompose(page, 409, {
    code: "upload_not_ready",
    message: "La grabación o la presentación no terminó de subirse; súbela de nuevo",
  });
  await newManualCourse(page, `Curso diapositivas perdidas ${Date.now()}`);
  await newModule(page, "Tomas perdidas", /Grabarme/);

  const studio = page.getByRole("dialog", { name: "Tomas perdidas" }).last();
  await studio.getByRole("button", { name: /Cámara y diapositivas/ }).click();
  await studio.locator('input[type="file"]').setInputFiles({
    name: "diapositivas.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(["Una sola diapositiva"]),
  });
  await expect(studio.getByRole("alert")).toContainText("No pudimos cargar tus diapositivas", { timeout: 60_000 });
  await studio.getByRole("button", { name: "Intentar de nuevo" }).click();
  await expect(studio.getByRole("img", { name: /^Diapositiva 1\b/ })).toBeVisible();

  await expect(studio.getByRole("button", { name: "Grabar" })).toBeEnabled({ timeout: 15_000 });
  await studio.getByRole("button", { name: "Grabar" }).click();
  await expect(studio.getByText(/Grabando · 0:0[1-9]/)).toBeVisible({ timeout: 10_000 });
  await studio.getByRole("button", { name: "Terminar" }).click();
  await studio.getByRole("button", { name: "Usar esta grabación" }).click();
  await expect(studio.getByRole("alert")).toContainText("súbela de nuevo", { timeout: 60_000 });
  expect(uploads).toHaveLength(2); // the deck and the recording

  await studio.getByRole("button", { name: "Usar esta grabación" }).click();
  await expect(page.getByText(/combinándola con tus diapositivas/)).toBeVisible({ timeout: 60_000 });
  expect(uploads).toHaveLength(3); // the recording went up again
  expect(composes).toHaveLength(2);
  expect(composes[1].recording_asset_id).not.toBe(composes[0].recording_asset_id);
  const sheet = page.getByRole("dialog", { name: "Tomas perdidas" });
  await expect(sheet.locator("video")).toBeVisible({ timeout: 120_000 });
});

test("subir una portada al curso", async ({ page }) => {
  await newManualCourse(page, `Curso con portada ${Date.now()}`);
  await page.getByRole("tab", { name: "Ajustes" }).click();
  await page.locator('input[type="file"][accept^="image/"]').setInputFiles({ name: "portada.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByText("Portada actualizada")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: "Portada actual" })).toBeVisible();
});

// Counts every camera stream and audio context the page opens, to check the studio gives them back.
async function trackMediaDevices(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[]; __contexts: AudioContext[] };
    w.__streams = [];
    w.__contexts = [];
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      w.__streams.push(stream);
      return stream;
    };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__contexts.push(this);
      }
    };
  });
}

const openMedia = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __streams: MediaStream[]; __contexts: AudioContext[] };
    return {
      liveTracks: w.__streams.flatMap((stream) => stream.getTracks()).filter((track) => track.readyState === "live").length,
      runningContexts: w.__contexts.filter((context) => context.state !== "closed").length,
    };
  });

/** Holds the direct uploads to storage for a while, so the test can act mid-upload. */
async function slowUploads(page: Page, ms: number) {
  await page.route("**/media/local/upload/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue().catch(() => undefined); // the page may have cancelled it meanwhile
  });
}

test("el estudio devuelve la cámara y el micrófono al cerrarse", async ({ page }) => {
  await trackMediaDevices(page);
  await newManualCourse(page, `Curso cámara ${Date.now()}`);
  const studio = await openCameraStudio(page, "Prueba de cámara");

  await studio.getByRole("button", { name: "Cerrar estudio" }).click();
  await expect(page.getByRole("button", { name: "Cerrar estudio" })).toBeHidden();
  await expect.poll(() => openMedia(page)).toEqual({ liveTracks: 0, runningContexts: 0 });
});

test("una grabación se sube una sola vez y no se descarta sin confirmar", async ({ page }) => {
  const uploads = trackUploads(page);
  await slowUploads(page, 3000);
  await newManualCourse(page, `Curso toma ${Date.now()}`);
  const studio = await openCameraStudio(page, "Toma única");
  await studio.getByRole("button", { name: "Grabar" }).click();
  await expect(studio.getByText(/Grabando · 0:0[1-9]/)).toBeVisible({ timeout: 10_000 });
  await studio.getByRole("button", { name: "Terminar" }).click();

  // Closing with a take not used yet asks first.
  await studio.getByRole("button", { name: "Cerrar estudio" }).click();
  const discard = page.getByRole("dialog", { name: "¿Descartar la grabación?" });
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "Cancelar" }).click();
  await expect(studio.getByRole("button", { name: "Usar esta grabación" })).toBeVisible();

  // A double click sends it once, and it can't be discarded while it uploads.
  await studio.getByRole("button", { name: "Usar esta grabación" }).dblclick();
  await expect(studio.getByText(/Subiendo/)).toBeVisible();
  await expect(studio.getByRole("button", { name: "Repetir" })).toBeDisabled();
  await expect(studio.getByRole("button", { name: "Cerrar estudio" })).toBeDisabled();
  await expect(page.getByText(/Grabación subida/)).toBeVisible({ timeout: 60_000 });
  expect(uploads).toHaveLength(1);
});

test("si la cámara se corta durante la cuenta regresiva, el estudio lo dice y se recupera", async ({ page }) => {
  await trackMediaDevices(page);
  await newManualCourse(page, `Curso sin cámara ${Date.now()}`);
  const studio = await openCameraStudio(page, "Cámara perdida");
  await studio.getByRole("button", { name: "Grabar" }).click();
  await page.evaluate(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop())); // e.g. unplugged
  });
  await expect(studio.getByRole("alert")).toContainText("No pudimos empezar a grabar", { timeout: 10_000 });
  await studio.getByRole("button", { name: "Reintentar" }).click();
  await expect(studio.getByRole("button", { name: "Grabar" })).toBeEnabled({ timeout: 15_000 });
});

test("cerrar el panel a mitad de una subida pide confirmación y un fallo pasajero al completar se reintenta", async ({ page }) => {
  await slowUploads(page, 3000);
  let failedCompletes = 0;
  await page.route("**/media/*/complete", async (route) => {
    if (failedCompletes > 0) return route.continue();
    failedCompletes += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ detail: "Servicio no disponible" }),
    });
  });
  await newManualCourse(page, `Curso subida larga ${Date.now()}`);
  await newModule(page, "Documento lento", /Video o documento/);
  const sheet = page.getByRole("dialog", { name: "Documento lento" });
  await sheet.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
    name: "manual.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Revisa el extintor cada mes."),
  });
  await expect(sheet.getByText(/Subiendo/)).toBeVisible();

  await page.keyboard.press("Escape");
  const question = page.getByRole("dialog", { name: "¿Cerrar y cancelar la subida?" });
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "Cancelar" }).click();
  await expect(sheet).toBeVisible();

  // The upload went on, and the failed `complete` was retried instead of asking to upload again.
  await expect(sheet.getByRole("link", { name: "Ver documento" })).toBeVisible({ timeout: 30_000 });
  expect(failedCompletes).toBe(1);

  await sheet.getByRole("button", { name: "Quitar" }).click();
  const removal = page.getByRole("dialog", { name: "¿Quitar el documento del módulo?" });
  await removal.getByRole("button", { name: "Quitar documento" }).click();
  await expect(sheet.getByText("Adjunta un documento para leer o descargar")).toBeVisible();
});
