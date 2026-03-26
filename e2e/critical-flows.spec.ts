import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Critical Flows - Action Colleague', () => {
  
  // Cursos
  test('should load courses page without errors', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', err => errors.push(err));
    
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    // Verificar que carga
    await expect(page.locator('h1')).toBeVisible();
    
    // No debe tener errores
    expect(errors).toHaveLength(0);
  });

  // Curso específico
  test('should load course detail without crashing', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', err => errors.push(err));
    
    await page.goto(`${BASE_URL}/admin/courses/15`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Verificar que NO hay TypeError
    expect(errors).toHaveLength(0);
  });

  // Evaluaciones
  test('should render evaluation analytics without errors', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', err => errors.push(err));
    
    await page.goto(`${BASE_URL}/admin/courses/15`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // No debe crashear
    expect(errors).toHaveLength(0);
  });

  // Empleados (el que está crasheando ahora)
  test('should load employees page without map error', async ({ page }) => {
    const mapErrors: Error[] = [];
    page.on('pageerror', err => {
      if (err.message.includes('map is not a function')) {
        mapErrors.push(err);
      }
    });
    
    await page.goto(`${BASE_URL}/admin/employees`);
    await page.waitForLoadState('networkidle');
    
    expect(mapErrors).toHaveLength(0);
  });

  // Empleados - debe renderear tabla
  test('should render employees table', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/employees`);
    await page.waitForLoadState('networkidle');
    
    // Debe existir tabla
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  // Dashboard
  test('should load admin dashboard', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', err => errors.push(err));
    
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h1')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  // Documentos
  test('should load documents page', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', err => errors.push(err));
    
    await page.goto(`${BASE_URL}/admin/documents`);
    await page.waitForLoadState('domcontentloaded');
    
    // Verificar que tabla carga
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
    
    expect(errors).toHaveLength(0);
  });

  // Cursos lista completa
  test('should load all courses without crash', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', err => errors.push(err));
    
    await page.goto(`${BASE_URL}/admin/courses`);
    await page.waitForLoadState('networkidle');
    
    expect(errors).toHaveLength(0);
  });
});
