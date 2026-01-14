import { test, expect, TestInfo } from '@playwright/test';

function creds(testInfo: TestInfo) {
  const project = testInfo.project.name.toLowerCase();
  const suffix = project.includes('mobile') ? 'mobile' : project.includes('tablet') ? 'tablet' : 'desktop';

  return {
    username: process.env.E2E_USER || `e2e-client-${suffix}`,
    password: process.env.E2E_PASS || 'E2Epass123!',
  };
}

test.describe('Booking – slot loading regression', () => {
  test('wejście w krok "Termin wizyty" zawsze wyzwala request slotów', async ({ page }, testInfo) => {
    test.setTimeout(60_000);

    const { username, password } = creds(testInfo);

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Nazwa użytkownika' }).fill(username);
    await page.getByLabel('Hasło').fill(password);
    await page.getByRole('button', { name: 'Zaloguj się' }).click();

    await page.waitForResponse(
      (r) => r.url().includes('/api/auth/status/') && r.status() === 200,
    );

    const [servicesResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/services/') &&
          r.request().method() === 'GET' &&
          r.url().includes('is_active=true'),
      ),
      page.goto('/client/booking'),
    ]);

    expect(servicesResp.status()).toBe(200);

    const servicesJson = await servicesResp.json();
    const services = servicesJson?.results ?? servicesJson ?? [];
    expect(Array.isArray(services)).toBeTruthy();
    expect(services.length).toBeGreaterThan(0);

    const serviceName: string = services[0].name;

    await expect(page.getByText('Wybierz usługę')).toBeVisible({ timeout: 10_000 });
    await page.getByText(serviceName, { exact: true }).click();

    const nextBtn = page.getByTestId('booking-next');
    await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
    await nextBtn.click();

    await expect(page.getByText('Wybierz specjalistę')).toBeVisible({ timeout: 10_000 });

    const employeeList = page.getByTestId('employee-list');
    const firstEmployee = employeeList.locator('button').first();

    await expect(firstEmployee).toBeVisible({ timeout: 10_000 });
    await firstEmployee.click();

    await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
    await nextBtn.click();

    await expect(page.getByText('Termin wizyty')).toBeVisible({ timeout: 10_000 });

    const slotsResponse = await page.waitForResponse(
      (r) =>
        r.url().includes('/api/availability/slots/') &&
        r.request().method() === 'GET',
      { timeout: 10_000 },
    );

    expect(slotsResponse.status()).toBe(200);
  });
});
