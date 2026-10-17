import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("authenticate as admin", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  expect(email && password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD").toBeTruthy();

  await page.goto("/login");
  await page.fill("#email", email!);
  await page.fill("#password", password!);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/admin/, { timeout: 15000 });

  await page.context().storageState({ path: authFile });
});
