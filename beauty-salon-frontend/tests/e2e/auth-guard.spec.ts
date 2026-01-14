import { test, expect } from '@playwright/test';

test.describe('E2E: ochrona tras (ProtectedRoute)', () => {
  test('niezalogowany użytkownik jest przekierowany do /login przy wejściu na trasę chronioną', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);

    await expect(page.getByRole('textbox', { name: 'Nazwa użytkownika' })).toBeVisible();
    await expect(page.getByRole('button', { name: /zaloguj/i })).toBeVisible();
  });
});
