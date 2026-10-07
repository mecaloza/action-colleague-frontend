import { test, expect } from "@playwright/test";

// Admins get the AI's proposal of activities, review them, publish them and try them as a learner would.
test.setTimeout(120_000);

test("un admin genera, edita, publica y prueba las actividades de un módulo", async ({ page }) => {
  const title = `Actividades en el estudio ${Date.now()}`;
  await page.goto("/admin/courses/new/manual");
  await page.getByLabel("Título del curso").fill(title);
  await page.getByRole("button", { name: /Crear y agregar contenido/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await page.getByRole("button", { name: "Agregar módulo" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Nuevo módulo" });
  await dialog.getByLabel("Título").fill("Diagnóstico");
  await dialog.getByRole("button", { name: "Crear módulo" }).click();
  const sheet = page.getByRole("dialog", { name: "Diagnóstico" });
  await sheet
    .getByLabel("Contenido de lectura")
    .fill(
      "Cómo leer el desgaste de una llanta, qué hacer con la presión de inflado y cómo hablar de costo por kilómetro.",
    );
  await sheet.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("tab", { name: "Actividades" }).click();
  await page.getByRole("button", { name: "Generar con IA" }).click();
  const list = page.getByRole("list", { name: "Actividades de Diagnóstico" });
  await expect(list.getByRole("listitem")).toHaveCount(3, { timeout: 30_000 }); // one per type that fits, 3 at most
  await expect(list.getByText("Borrador")).toHaveCount(3);

  // Edit the conversation's title, publish it and try it.
  await page.getByRole("button", { name: "Editar Cliente que solo pide precio" }).click();
  const editor = page.getByRole("dialog", { name: "Decisión con cliente" });
  await editor.getByLabel("Título").fill("El cliente que solo pide precio");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await expect(editor).toBeHidden();
  await page.getByRole("button", { name: "Publicar El cliente que solo pide precio" }).click();
  await expect(list.getByText("Publicada")).toBeVisible();

  const item = list.getByRole("listitem").filter({ hasText: "El cliente que solo pide precio" });
  await item.getByRole("button", { name: /Probar/ }).click();
  const game = page.getByRole("dialog");
  await game.getByRole("button", { name: /Empezar/ }).click();
  await game.getByRole("button", { name: "Le pregunto por su ruta." }).click();
  await expect(game.getByText("Entiendes su operación.")).toBeVisible();
  await game.getByRole("button", { name: "Le muestro el costo por km." }).click();
  await game.getByRole("button", { name: /Ver resultado/ }).click();
  await expect(game.getByText("¡Excelente!")).toBeVisible();
  await game.getByRole("button", { name: "Continuar" }).click();

  // A simulator whose formula doesn't hold up is refused, with the reason.
  await page.getByRole("button", { name: /^Editar Baja el costo por km/ }).click();
  const simulator = page.getByRole("dialog", { name: "Simulador con reto" });
  await simulator.getByLabel(/^Fórmula/).fill("precio ** km");
  await expect(simulator.getByText(/no se entiende/)).toBeVisible(); // checked as it is typed
  await simulator.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/no se entiende/).last()).toBeVisible();
});
