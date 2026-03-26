import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('https://action-colleague.vercel.app/login');
  await page.fill('input[type="email"]', 'admin@actioncolleague.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Esperar a que redirija
  await page.waitForURL(/\/admin/, { timeout: 10000 });
  
  // Guardar estado de autenticación
  await page.context().storageState({ path: authFile });
});
