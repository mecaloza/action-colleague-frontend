import { test, expect, type APIRequestContext } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:8001/api/v1";
const admin = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };

test.setTimeout(90_000);

/** A new collaborator added through the API; returns their email. */
async function addPerson(request: APIRequestContext, name: string): Promise<string> {
  const login = await request.post(`${API}/auth/login`, { data: admin });
  expect(login.ok()).toBeTruthy();
  const email = `foco.${Date.now()}@local.test`;
  const response = await request.post(`${API}/users`, {
    headers: { Authorization: `Bearer ${(await login.json()).access_token}` },
    data: { name, email, password: "Temporal-2026", role: "collaborator" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return email;
}

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

test("al cerrar la ficha o un diálogo, el foco vuelve a quien lo abrió", async ({ page, request }) => {
  const name = `Foco ${Date.now()}`;
  const email = await addPerson(request, name);
  await page.goto("/admin/team");
  await page.getByLabel("Buscar personas").fill(name);
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toHaveCount(1);

  // The detail, opened with the keyboard from the name.
  const nameButton = row.getByRole("button", { name, exact: true });
  await nameButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nameButton).toBeFocused();

  // Dialogs opened from the row's menu go back to the menu's button, also those that start on a field.
  const rowMenu = row.getByRole("button", { name: `Acciones para ${name}` });
  const edit = page.getByRole("dialog", { name: `Editar a ${name}` });
  await rowMenu.click();
  await page.getByRole("menuitem", { name: /Editar datos/ }).click();
  await expect(edit.getByLabel("Nombre")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(rowMenu).toBeFocused();

  // "Nueva contraseña" starts on a new temporary password.
  await rowMenu.click();
  await page.getByRole("menuitem", { name: /Nueva contraseña/ }).click();
  const password = edit.getByLabel("Contraseña nueva (opcional)");
  await expect(password).toBeFocused();
  await expect(password).toHaveValue(/^[A-Za-z0-9]{12}$/);
  await page.keyboard.press("Escape");
  await expect(rowMenu).toBeFocused();

  await rowMenu.click();
  await page.getByRole("menuitem", { name: /Desactivar/ }).click();
  await page.getByRole("dialog", { name: `¿Desactivar a ${name}?` }).getByRole("button", { name: "Cancelar" }).click();
  await expect(rowMenu).toBeFocused();
  await expect(row).not.toContainText("Inactivo");
});
