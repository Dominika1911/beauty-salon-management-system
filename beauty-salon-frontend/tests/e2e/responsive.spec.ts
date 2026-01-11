import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

for (const vp of viewports) {
  test(`Responsywność: LoginPage renderuje formularz (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto('/login');

    await expect(page.getByRole('textbox', { name: 'Nazwa użytkownika' })).toBeVisible();
    await expect(page.getByLabel('Hasło')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zaloguj się' })).toBeVisible();
    await page.screenshot({ path: `test-results/responsive-login.${vp.name}.png`, fullPage: true });
  });
}
