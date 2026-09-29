import { test, expect, type Page } from "@playwright/test";

const learnerEmail = process.env.E2E_LEARNER_EMAIL ?? "";

function trackErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  return errors;
}

async function addTextModule(page: Page, title: string, content: string) {
  await page.getByRole("button", { name: "Agregar módulo" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Nuevo módulo" });
  await dialog.getByLabel("Título").fill(title);
  await dialog.getByRole("button", { name: "Crear módulo" }).click();
  // The new module opens in the side panel to add its content.
  const sheet = page.getByRole("dialog", { name: title });
  await sheet.getByLabel("Contenido de lectura").fill(content);
  await sheet.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(sheet).toBeHidden();
}

/** Creates an empty own-material course and lands on its editor. */
async function createManualCourse(page: Page, title: string) {
  await page.goto("/admin/courses/new/manual");
  await page.getByLabel("Título del curso").fill(title);
  await page.getByRole("button", { name: /Crear y agregar contenido/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

/** Picks an entry from the editor's "Más acciones" menu. */
async function chooseCourseAction(page: Page, action: string) {
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

test("un admin crea, completa, publica y asigna un curso con su propio material", async ({ page }) => {
  const errors = trackErrors(page);
  const title = `Seguridad en planta ${Date.now()}`;

  await page.goto("/admin/courses/new");
  await page.getByRole("link", { name: /Con mi material/ }).click();
  await page.getByLabel("Título del curso").fill(title);
  await page.getByLabel("Descripción (opcional)").fill("Uso correcto del equipo de protección.");
  await page.getByRole("button", { name: /Crear y agregar contenido/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // Publishing an empty course explains what is missing.
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByRole("dialog", { name: "Falta poco para publicar" })).toContainText("Agrega al menos un módulo");
  await page.getByRole("button", { name: "Entendido" }).click();

  await addTextModule(page, "Introducción", "Por qué usamos casco.");
  await addTextModule(page, "Equipo de protección", "Casco, guantes y botas.");
  await expect(page.getByRole("listitem").filter({ hasText: "Equipo de protección" })).toContainText("02");

  // Evaluation for the second module: one true/false question.
  await page.getByRole("tab", { name: "Evaluaciones" }).click();
  await page.getByRole("button", { name: /Equipo de protección/ }).click();
  await page.getByRole("button", { name: "Agregar pregunta" }).click();
  await page.getByRole("menuitem", { name: /Verdadero \/ falso/ }).click();
  await page.getByLabel("Afirmación").fill("El casco es opcional");
  await page.getByRole("button", { name: "Falso" }).click();
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page.getByText("Evaluación guardada")).toBeVisible();

  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Curso publicado")).toBeVisible();
  await expect(page.getByText("Publicado", { exact: true }).first()).toBeVisible();

  if (learnerEmail) {
    await page.getByRole("tab", { name: "Participantes" }).click();
    await page.getByRole("button", { name: "Asignar personas" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Asignar personas" });
    await dialog.getByPlaceholder(/Buscar/).fill(learnerEmail);
    await dialog.getByRole("button", { name: new RegExp(learnerEmail) }).click();
    await dialog.getByRole("button", { name: /Asignar \(1\)/ }).click();
    await expect(page.getByRole("cell", { name: new RegExp(learnerEmail.split("@")[0], "i") }).first()).toBeVisible();
  }

  // Preview: every module open, as a learner would see it.
  await page.getByRole("link", { name: "Vista previa" }).click();
  await expect(page.getByText("Por qué usamos casco.")).toBeVisible();
  await page.getByRole("button", { name: /Equipo de protección/ }).click();
  await expect(page.getByText(/Evaluación de 1 pregunta /)).toBeVisible();

  expect(errors).toHaveLength(0);
});

test("la biblioteca filtra, busca y archiva cursos", async ({ page }) => {
  const title = `Curso archivable ${Date.now()}`;
  await createManualCourse(page, title);

  await chooseCourseAction(page, "Archivar curso");
  await expect(page.getByText("Curso archivado")).toBeVisible();

  await page.goto("/admin/courses");
  await page.getByLabel("Buscar cursos").fill(title);
  // Archived courses leave the default view…
  await expect(page.getByText("No hay cursos que coincidan")).toBeVisible();
  // …and are found under "Archivados".
  await page.getByRole("button", { name: "Archivados" }).click();
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.getByRole("button", { name: "Borradores" }).click();
  await expect(page.getByText("No hay cursos que coincidan")).toBeVisible();
});

test("eliminar un curso pide confirmación", async ({ page }) => {
  const title = `Curso para borrar ${Date.now()}`;
  await createManualCourse(page, title);

  await chooseCourseAction(page, "Eliminar curso");
  const confirm = page.getByRole("dialog", { name: "¿Eliminar este curso?" });
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await chooseCourseAction(page, "Eliminar curso");
  await page.getByRole("dialog", { name: "¿Eliminar este curso?" }).getByRole("button", { name: "Eliminar curso" }).click();
  await expect(page).toHaveURL(/\/admin\/courses$/);
});
