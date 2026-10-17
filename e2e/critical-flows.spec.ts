import { test, expect, type Page } from "@playwright/test";

/** Collects uncaught page errors so each test can assert the screen didn't crash. */
function trackErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  return errors;
}

test.describe("Admin (sesión iniciada)", () => {
  test("el panel carga sin errores", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/admin");
    await expect(page.locator("h1").first()).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("la biblioteca de cursos carga sin errores", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/admin/courses");
    await expect(page.locator("h1").first()).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("el equipo carga y muestra la tabla", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/admin/team");
    await expect(page.locator("table")).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("las URLs anteriores redirigen a las nuevas", async ({ page }) => {
    await page.goto("/admin/employees");
    await expect(page).toHaveURL(/\/admin\/team$/);
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/documents");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("el menú móvil se abre, navega y se cierra con Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const menu = page.getByRole("dialog", { name: "Menú principal" });
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await page.getByRole("button", { name: "Abrir menú" }).click();
    await menu.getByRole("link", { name: "Cursos" }).click();
    await expect(page).toHaveURL(/\/admin\/courses$/);
    await expect(menu).toBeHidden();
  });
});
