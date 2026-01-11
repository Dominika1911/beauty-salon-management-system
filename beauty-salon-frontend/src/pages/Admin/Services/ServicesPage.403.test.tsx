import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import ServicesPage from './ServicesPage';
import { servicesApi } from '@/api/services';
import type { DRFPaginated, Service } from '@/types';

vi.mock('@/api/services', () => ({
  servicesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  },
}));

function renderPage() {
  const theme = createTheme();
  return render(
    <MemoryRouter initialEntries={['/admin/services']}>
      <ThemeProvider theme={theme}>
        <ServicesPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('Admin/Services/ServicesPage – obsługa 403 z API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // createTheme w testach bywa ciężkie, ale nie refaktorujemy architektury;
    // czyścimy tylko mocki.
    vi.clearAllMocks();
  });

  it('gdy create() zwróci 403 – pokazuje komunikat i nie zamyka dialogu', async () => {
    const payload: DRFPaginated<Service> = { count: 0, next: null, previous: null, results: [] };
    vi.mocked(servicesApi.list).mockResolvedValue(payload);

    vi.mocked(servicesApi.create).mockRejectedValue({
      response: { status: 403, data: { detail: 'Brak dostępu' } },
    });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(servicesApi.list).toHaveBeenCalledTimes(1));

    // Kontrakt UI zgodny z innymi testami w repo
    await user.click(await screen.findByRole('button', { name: 'Dodaj usługę' }));

    const dialog = await screen.findByRole('dialog');
    const d = within(dialog);

    // Minimalne wypełnienie aby przejść lokalną walidację i faktycznie wywołać create()
    await user.type(d.getByRole('textbox', { name: /Nazwa/i }), 'Testowa usługa');
    await user.clear(d.getByRole('textbox', { name: /Cena \(zł\)/i }));
    await user.type(d.getByRole('textbox', { name: /Cena \(zł\)/i }), '100');
    await user.clear(d.getByRole('textbox', { name: /Czas \(min\)/i }));
    await user.type(d.getByRole('textbox', { name: /Czas \(min\)/i }), '30');

    await user.click(d.getByRole('button', { name: 'Zapisz' }));

    await waitFor(() => expect(servicesApi.create).toHaveBeenCalledTimes(1));

    // Dowód: dialog zostaje + komunikat z API widoczny
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(d.getByText('Dodaj usługę')).toBeInTheDocument();
    expect(await d.findByText('Brak dostępu')).toBeInTheDocument();
  });
});
