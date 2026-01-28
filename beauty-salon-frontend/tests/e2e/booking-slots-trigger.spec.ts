import { test, expect, TestInfo } from '@playwright/test';

function creds(testInfo: TestInfo) {
  const project = testInfo.project.name.toLowerCase();
  const suffix = project.includes('mobile')
    ? 'mobile'
    : project.includes('tablet')
      ? 'tablet'
      : 'desktop';

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

    const statusResp = await page.waitForResponse(
      (r) => r.url().includes('/api/auth/status/') && r.request().method() === 'GET',
      { timeout: 15_000 },
    );
    expect(statusResp.status()).toBe(200);
    const statusJson = await statusResp.json().catch(() => null);
    expect(statusJson?.isAuthenticated).toBeTruthy();

    const servicesApiResp = await page.request.get('/api/services/?is_active=true', { timeout: 15_000 });
    const st = servicesApiResp.status();
    const servicesBody = await servicesApiResp.text().catch(() => '');
    if (st < 200 || st >= 300) {
      throw new Error(`GET /api/services/?is_active=true zwrócił ${st}. Body: ${servicesBody.slice(0, 800)}`);
    }

    let servicesJson: any;
    try {
      servicesJson = JSON.parse(servicesBody);
    } catch {
      throw new Error(`GET /api/services zwrócił nie-JSON. Body: ${servicesBody.slice(0, 300)}`);
    }

    const services = servicesJson?.results ?? servicesJson ?? [];
    expect(Array.isArray(services)).toBeTruthy();
    expect(services.length).toBeGreaterThan(0);
    const serviceName: string = services[0].name;

    const servicesRe = /\/api\/services\/?(\?.*)?$/;
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (servicesRe.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: servicesBody,
        });
        return;
      }
      await route.continue();
    });

    const navBooking = page.getByRole('link', { name: /rezerwacja/i });
    if (await navBooking.count()) {
        await navBooking.first().click();
    } else {
        await page.getByRole('link', { name: /umów wizytę/i }).click();
    }
    await expect(page).toHaveURL(/\/client\/booking/);


    const nextBtn = page.getByTestId('booking-next');
    await expect(nextBtn).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText(serviceName, { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByText(serviceName, { exact: true }).click();
    await expect(nextBtn).toBeEnabled({ timeout: 10_000 });

    await nextBtn.click();
    await expect(page.getByText('Wybierz specjalistę')).toBeVisible({ timeout: 10_000 });

    const employeeList = page.getByTestId('employee-list');
    await expect(employeeList).toBeVisible({ timeout: 10_000 });
    await employeeList.locator('button').first().click();

    await expect(nextBtn).toBeEnabled({ timeout: 10_000 });

    const slotsPromise = page.waitForResponse(
      (r) => {
        if (r.request().method() !== 'GET') return false;
        const u = new URL(r.request().url());
        return (
          u.pathname === '/api/availability/slots/' ||
          u.pathname === '/api/availability/slots' ||
          u.pathname === '/availability/slots/' ||
          u.pathname === '/availability/slots'
        );
      },
      { timeout: 20_000 },
    );

    await nextBtn.click();
    await expect(page.getByText('Termin wizyty')).toBeVisible({ timeout: 10_000 });

    const slotsResponse = await slotsPromise;
    expect(slotsResponse.status()).toBeLessThan(400);
  });
});
