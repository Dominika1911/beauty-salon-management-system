import { test, expect, Page, TestInfo, APIResponse, Request } from '@playwright/test';

function creds(testInfo: TestInfo) {
  const project = testInfo.project.name.toLowerCase();
  const suffix = project.includes('mobile') ? 'mobile' : project.includes('tablet') ? 'tablet' : 'desktop';

  return {
    username: process.env.E2E_USER || `e2e-client-${suffix}`,
    password: process.env.E2E_PASS || 'E2Epass123!',
  };
}

async function expectLoginOk(page: Page) {
  const loginResp = await page.waitForResponse(
    (r) => r.url().includes('/api/auth/login/') && r.request().method() === 'POST',
  );

  const status = loginResp.status();
  if (status < 200 || status >= 300) {
    const bodyText = await loginResp.text().catch(() => '<nie udało się odczytać body>');
    throw new Error(`Login endpoint zwrócił ${status}. Body: ${bodyText}`);
  }

  const statusResp = await page.waitForResponse(
    (r) => r.url().includes('/api/auth/status/') && r.request().method() === 'GET',
  );

  expect(statusResp.status()).toBe(200);
  const body = await statusResp.json();
  expect(body).toMatchObject({ isAuthenticated: true });
  expect(body.user).toBeTruthy();
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toDatePickerPL(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function formatTimeRangePL(startISO: string, endISO: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const s = new Date(startISO).toLocaleTimeString('pl-PL', opts);
  const e = new Date(endISO).toLocaleTimeString('pl-PL', opts);
  return `${s} – ${e}`;
}

async function openDatePicker(page: Page) {
  const dateInput = page.getByTestId('booking-date-input');
  await expect(dateInput).toBeVisible({ timeout: 10_000 });
  await dateInput.scrollIntoViewIfNeeded();
  await dateInput.click({ force: true });
  return dateInput;
}

async function clickDayInMuiCalendar(page: Page, target: Date) {
  const d = new Date(target);
  d.setHours(0, 0, 0, 0);
  const ts = String(d.getTime());

  const byTs = page
    .locator(`button[data-timestamp="${ts}"]`)
    .first()
    .or(page.locator(`[data-timestamp="${ts}"]`).first());

  if (await byTs.count()) {
    await expect(byTs).toBeVisible({ timeout: 5000 });
    if (await byTs.isDisabled()) throw new Error(`Dzień disabled (data-timestamp=${ts})`);
    await byTs.click();
  } else {
    const firstEnabled = page.locator('button.MuiPickersDay-root:not([disabled])').first();
    await expect(firstEnabled).toBeVisible({ timeout: 5000 });
    await firstEnabled.click();
  }

  const okBtn = page.getByRole('button', { name: /ok|zatwierdź|wybierz|potwierdź/i });
  if (await okBtn.count()) await okBtn.first().click();
}

async function waitForSlotsUI(page: Page) {
  const spinner = page.getByRole('progressbar');
  if (await spinner.count()) {
    await spinner.first().waitFor({ state: 'visible', timeout: 1500 }).catch(() => void 0);
    await spinner.first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => void 0);
  }

  const noSlotsAlert = page.getByText(/brak wolnych terminów/i);
  const anySlotBtn = page.locator('button').filter({ hasText: /\d{2}:\d{2}\s*–\s*\d{2}:\d{2}/ });

  await Promise.race([
    noSlotsAlert.waitFor({ state: 'visible', timeout: 8000 }),
    anySlotBtn.first().waitFor({ state: 'visible', timeout: 8000 }),
  ]);
}

/**
 * Tablet/Mobile: MUI DatePicker potrafi zmienić input bez wysłania fetch.
 * Zamiast czekać na konkretny response (date=...), łapiemy URL requestu slots
 * przez listener na request oraz asercję na efekt UI (sloty/brak slotów).
 */
async function setDateInPicker(page: Page, target: Date) {
  const iso = toISODate(target);
  const pl = toDatePickerPL(target);

  let lastSlotsUrl: string | null = null;

  const onRequest = (req: Request) => {
    const url = req.url();
    if (url.includes('/api/availability/slots/') && req.method() === 'GET') {
      lastSlotsUrl = url;
    }
  };

  page.on('request', onRequest);

  try {
    const dateInput = await openDatePicker(page);
    const isReadonly = (await dateInput.getAttribute('readonly')) !== null;

    if (!isReadonly) {
      await dateInput.fill(pl);
      await dateInput.press('Enter');
      // Mobile/Tablet często wymaga blur/touch, żeby odpalił się fetch:
      await dateInput.press('Tab').catch(() => void 0);
    } else {
      await clickDayInMuiCalendar(page, target);
      // domykamy overlay + finalny "commit" dla MUI
      await page.keyboard.press('Escape').catch(() => void 0);
    }

    await waitForSlotsUI(page);

    return { iso, slotsUrl: lastSlotsUrl };
  } finally {
    page.off('request', onRequest);
  }
}

async function fetchSlotsForDateViaApi(page: Page, baseSlotsUrl: string, dateISO: string) {
  const u = new URL(baseSlotsUrl);
  u.searchParams.set('date', dateISO);

  const res: APIResponse = await page.request.get(u.toString(), { timeout: 8000 });
  const status = res.status();
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = { raw: await res.text().catch(() => '') };
  }
  return { status, json, url: u.toString() };
}

async function ensureBaseSlotsRequest(page: Page, testInfo: TestInfo) {
  const project = testInfo.project.name.toLowerCase();
  const baseOffset = project.includes('mobile') ? 3 : project.includes('tablet') ? 2 : 1;

  const d1 = new Date();
  d1.setDate(d1.getDate() + baseOffset);

  // 1) próba
  let r = await setDateInPicker(page, d1);
  if (r.slotsUrl) return r.slotsUrl;

  // 2) „touch” tej samej daty (często dopiero wtedy UI odpala fetch)
  r = await setDateInPicker(page, d1);
  if (r.slotsUrl) return r.slotsUrl;

  // 3) +1 dzień
  const d2 = new Date(d1);
  d2.setDate(d2.getDate() + 1);

  r = await setDateInPicker(page, d2);
  if (r.slotsUrl) return r.slotsUrl;

  // 4) wróć do d1 (zmiana tam i z powrotem potrafi odpalić effect)
  r = await setDateInPicker(page, d1);
  if (r.slotsUrl) return r.slotsUrl;

  throw new Error(
    'Nie udało się wymusić requestu /api/availability/slots/ przez UI (po kilku realnych interakcjach).',
  );
}

async function pickDayWithSlotsFast(page: Page, testInfo: TestInfo, baseSlotsUrl: string) {
  const project = testInfo.project.name.toLowerCase();
  const baseOffset = project.includes('mobile') ? 3 : project.includes('tablet') ? 2 : 1;

  let last: any = null;

  for (let i = 0; i <= 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() + baseOffset + i);
    const dateISO = toISODate(d);

    const { status, json } = await fetchSlotsForDateViaApi(page, baseSlotsUrl, dateISO);
    last = { status, json, dateISO };

    if (status === 200 && Array.isArray(json?.slots) && json.slots.length > 0) {
      // ustawiamy znalezioną datę w UI (realna interakcja)
      await setDateInPicker(page, d);
      return json;
    }
  }

  throw new Error(`Brak slotów mimo seeda E2E. Ostatnia: ${JSON.stringify(last)}`);
}

test.describe.serial('E2E: login → booking → lista wizyt', () => {
  test('klient rezerwuje wizytę i widzi ją na liście', async ({ page }, testInfo) => {
    test.setTimeout(90_000);

    const { username, password } = creds(testInfo);

    // --- LOGIN ---
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Nazwa użytkownika' }).fill(username);
    await page.getByLabel('Hasło').fill(password);
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await expectLoginOk(page);

    // --- BOOKING ---
    const [servicesResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/services/?is_active=true') &&
          r.request().method() === 'GET',
      ),
      page.goto('/client/booking'),
    ]);
    expect(servicesResp.status()).toBe(200);

    const servicesJson = await servicesResp.json();
    const all = servicesJson?.results ?? servicesJson ?? [];
    const e2eService = all.find((s: any) => typeof s?.name === 'string' && s.name.startsWith('E2E -'));
    const serviceName: string | undefined = e2eService?.name ?? all?.[0]?.name;
    expect(serviceName).toBeTruthy();

    await expect(page.getByText('Wybierz usługę')).toBeVisible({ timeout: 10_000 });
    await page.getByText(serviceName as string, { exact: true }).click();

    const nextBtn = page.getByTestId('booking-next');
    await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
    await nextBtn.click();

    // --- specjalista ---
    await expect(page.getByText('Wybierz specjalistę')).toBeVisible({ timeout: 10_000 });
    const employeeList = page.getByTestId('employee-list');
    await expect(employeeList).toBeVisible({ timeout: 10_000 });

    const e2eEmployee = employeeList.getByRole('button', { name: /e2e.*pracownik/i }).first();
    if (await e2eEmployee.count()) {
      await e2eEmployee.click();
    } else {
      await employeeList.locator('button').first().click();
    }

    await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
    await nextBtn.click();

    // --- termin / sloty ---
    await expect(page.getByText('Termin wizyty')).toBeVisible({ timeout: 10_000 });

    // Tablet/Mobile: slots request może nie polecieć sam → wymuszamy realnym wyborem daty,
    // a bazowy URL łapiemy z request-listenera.
    const baseSlotsUrl = await ensureBaseSlotsRequest(page, testInfo);

    const slotsData = await pickDayWithSlotsFast(page, testInfo, baseSlotsUrl);
    expect(Array.isArray(slotsData.slots)).toBeTruthy();
    expect(slotsData.slots.length).toBeGreaterThan(0);

    // --- booking (retry na konflikt 400) ---
    const confirmBtn = page.getByTestId('booking-next');
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });

    let lastError: string | null = null;
    let booked = false;

    for (const slot of slotsData.slots.slice(0, 6)) {
      const slotLabel = formatTimeRangePL(slot.start, slot.end);

      await page.getByRole('button', { name: slotLabel }).click();
      await expect(confirmBtn).toBeEnabled({ timeout: 10_000 });

      const [bookResp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/appointments/book/') && r.request().method() === 'POST'),
        confirmBtn.click(),
      ]);

      const st = bookResp.status();
      if (st >= 200 && st < 300) {
        booked = true;
        break;
      }

            const headers = bookResp.headers();
      const contentType = headers['content-type'] ?? '';
      const bodyText = await bookResp.text().catch(() => '');
      const bodySnippet = bodyText.length > 800 ? `${bodyText.slice(0, 800)}…` : bodyText;

      lastError = `BOOK FAILED ${st} ${bookResp.url()} content-type=${contentType}\n${bodySnippet}`;

      // Slot-specyficzne błędy (konflikt/walidacja) -> próbujemy kolejny slot.
      if (st === 400 || st === 409) continue;

      throw new Error(lastError);

    }

    if (!booked) throw new Error(lastError || 'Nie udało się zarezerwować żadnego z testowanych slotów.');

    await expect(page).toHaveURL(/\/client\/appointments/);
    await expect(page.locator('body')).toContainText(/wizy|wizyt/i);
  });
});
