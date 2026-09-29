import { test, expect, type Page } from "@playwright/test";

// These flows start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

const admin = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };
const learner = { email: process.env.E2E_LEARNER_EMAIL ?? "", password: process.env.E2E_LEARNER_PASSWORD ?? "" };

async function signIn(page: Page, email: string, password: string) {
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /ingresar/i }).click();
}

test("una ruta protegida sin sesión lleva al login y vuelve después", async ({ page }) => {
  await page.goto("/admin/courses");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fcourses$/);
  await signIn(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin\/courses$/);
});

test("el parámetro next no permite salir del dominio", async ({ page, baseURL }) => {
  await page.goto("/login?next=/%5Cevil.example");
  await signIn(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin$/);
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
});

test("una contraseña incorrecta muestra el error en español", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, admin.email, "contraseña-incorrecta");
  await expect(page.locator("#login-error")).toHaveText(/Correo o contraseña incorrectos/);
});

test("cerrar sesión lleva al login sin next", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: /^Menú de / }).click();
  await page.getByRole("menuitem", { name: /cerrar sesión/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("un colaborador que entra a /admin termina en /learn", async ({ page }) => {
  test.skip(!learner.email || !learner.password, "Define E2E_LEARNER_EMAIL y E2E_LEARNER_PASSWORD");
  await page.goto("/login");
  await signIn(page, learner.email, learner.password);
  await expect(page).toHaveURL(/\/learn$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/learn$/);
});
