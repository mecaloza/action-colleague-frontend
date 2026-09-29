import { test, expect } from "@playwright/test";

test.setTimeout(90_000);

test("un admin agrega a una persona, que entra con su contraseña temporal, y la desactiva", async ({ page, browser }) => {
  const email = `persona.${Date.now()}@local.test`;

  await page.goto("/admin/team");
  await page.getByRole("button", { name: /Agregar persona/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Agregar persona" });
  await dialog.getByLabel("Nombre").fill("Ana Prueba");
  await dialog.getByLabel("Correo").fill(email);
  await dialog.getByLabel("Cargo").fill("Operaria");
  await dialog.getByLabel("Área").fill("Producción");
  const password = await dialog.getByLabel("Contraseña temporal").inputValue();
  expect(password).toHaveLength(12);
  await dialog.getByRole("button", { name: "Agregar persona" }).click();
  await expect(page.getByText(/Ana Prueba ya puede ingresar/)).toBeVisible();

  // The new person signs in with the temporary password.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const learner = await context.newPage();
  await learner.goto("/login");
  await learner.getByLabel("Correo electrónico").fill(email);
  await learner.getByLabel("Contraseña", { exact: true }).fill(password);
  await learner.getByRole("button", { name: /Ingresar/ }).click();
  await expect(learner).toHaveURL(/\/learn$/);
  await expect(learner.getByText("Aún no tienes cursos asignados")).toBeVisible();
  await context.close();

  // Search, open the detail, edit.
  await page.getByLabel("Buscar personas").fill("Ana Prueba");
  const row = page.getByRole("row").filter({ hasText: email });
  const rowMenu = row.getByRole("button", { name: "Acciones para Ana Prueba" });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Ana Prueba", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Ana Prueba" });
  await expect(sheet.getByText("No tiene cursos asignados")).toBeVisible();
  await page.keyboard.press("Escape");

  await rowMenu.click();
  await page.getByRole("menuitem", { name: /Editar datos/ }).click();
  const edit = page.getByRole("dialog", { name: "Editar a Ana Prueba" });
  await edit.getByLabel("Cargo").fill("Supervisora");
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(row).toContainText("Supervisora");

  // Deactivate (asks first), then find her among the inactive ones and bring her back.
  await rowMenu.click();
  await page.getByRole("menuitem", { name: /Desactivar/ }).click();
  await page.getByRole("dialog", { name: "¿Desactivar a Ana Prueba?" }).getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText("Ana Prueba ya no puede ingresar")).toBeVisible();
  await expect(row).toHaveCount(0);

  await page.getByRole("switch", { name: "Mostrar inactivos" }).click();
  await expect(row).toContainText("Inactivo");
  await rowMenu.click();
  await page.getByRole("menuitem", { name: /Reactivar/ }).click();
  await expect(page.getByText("Ana Prueba puede volver a ingresar")).toBeVisible();
});
