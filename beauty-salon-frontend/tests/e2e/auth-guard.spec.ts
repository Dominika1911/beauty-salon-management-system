import { test, expect } from '@playwright/test';

test.describe('E2E: ochrona tras (ProtectedRoute)', () => {
  test('niezalogowany użytkownik jest przekierowany do /login przy wejściu na trasę chronioną', async ({ page }) => {
    // Trasa chroniona w Twoim routerze
    await page.goto('/dashboard');

    // ProtectedRoute -> Navigate("/login")
    await expect(page).toHaveURL(/\/login$/);

    // Dodatkowo upewniamy się, że to faktycznie ekran logowania (Twoje labelki)
    await expect(page.getByRole('textbox', { name: 'Nazwa użytkownika' })).toBeVisible();
    await expect(page.getByRole('button', { name: /zaloguj/i })).toBeVisible();
  });
});
