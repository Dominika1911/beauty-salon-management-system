import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ServicesPage from './ServicesPage';
import { servicesApi } from '@/api/services';
import type { DRFPaginated, Service } from '@/types';

vi.mock('@/api/services', () => {
    return {
        servicesApi: {
            list: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            disable: vi.fn(),
            enable: vi.fn(),
        },
    };
});

function renderPage(initialEntries: string[] = ['/admin/services']) {
    return render(
        <MemoryRouter initialEntries={initialEntries}>
            <ServicesPage />
        </MemoryRouter>,
    );
}

function getHelperTextEl(input: HTMLElement): HTMLElement {
    const describedBy = input.getAttribute('aria-describedby');
    if (!describedBy) throw new Error('Input nie ma aria-describedby (brak helperText id).');

    const helper = document.getElementById(describedBy);
    if (!helper) throw new Error(`Nie znaleziono elementu helperText o id="${describedBy}".`);

    return helper;
}

describe('pages/Admin/Services/ServicesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renderuje listę usług z servicesApi.list() (DRF results)', async () => {
        const payload: DRFPaginated<Service> = {
            count: 1,
            next: null,
            previous: null,
            results: [
                {
                    id: 1,
                    name: 'Strzyżenie',
                    category: null,
                    description: 'Opis',
                    price: '50.00',
                    duration_minutes: 30,
                    duration_display: '30 min',
                    is_active: true,
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                },
            ],
        };

        vi.mocked(servicesApi.list).mockResolvedValue(payload);

        renderPage();

        expect(await screen.findByText('Usługi')).toBeInTheDocument();
        expect(await screen.findByText('Strzyżenie')).toBeInTheDocument();

        expect(servicesApi.list).toHaveBeenCalledTimes(1);
    });

    it('przy niepoprawnych danych NIE wywołuje create() i pokazuje błąd formularza (bez zgadywania treści walidacji)', async () => {
        const payload: DRFPaginated<Service> = {
            count: 0,
            next: null,
            previous: null,
            results: [],
        };
        vi.mocked(servicesApi.list).mockResolvedValue(payload);

        renderPage();

        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Dodaj usługę' }));

        const dialog = await screen.findByRole('dialog');
        const d = within(dialog);

        // Celowo NIE opieramy się na domyślnych wartościach emptyForm.
        // Zostawiamy pola puste, żeby wywołać walidację.
        const nameInput = d.getByRole('textbox', { name: /Nazwa/i });
        const priceInput = d.getByRole('textbox', { name: /Cena \(zł\)/i });
        const durationInput = d.getByRole('textbox', { name: /Czas \(min\)/i });

        await user.clear(nameInput);
        await user.clear(priceInput);
        await user.clear(durationInput);

        await user.click(d.getByRole('button', { name: 'Zapisz' }));

        // Dowód zachowania: jest błąd formularza (Alert) i nie było wywołania create.
        expect(await d.findByRole('alert')).toBeInTheDocument();
        expect(servicesApi.create).not.toHaveBeenCalled();

        // Dowód, że błędy są przypięte do pól (helperText istnieje),
        // ale NIE zgadujemy ich treści.
        expect(getHelperTextEl(nameInput).textContent?.trim().length).toBeGreaterThan(0);
        expect(getHelperTextEl(priceInput).textContent?.trim().length).toBeGreaterThan(0);
        expect(getHelperTextEl(durationInput).textContent?.trim().length).toBeGreaterThan(0);
    });

    it('gdy create() zwróci 400 z błędem pola -> mapuje go do helperText (parseDrfError + pickFieldErrors)', async () => {
        const payload: DRFPaginated<Service> = {
            count: 0,
            next: null,
            previous: null,
            results: [],
        };
        vi.mocked(servicesApi.list).mockResolvedValue(payload);

        vi.mocked(servicesApi.create).mockRejectedValue({
            response: {
                data: {
                    name: ['To pole jest wymagane.'],
                },
            },
        });

        renderPage();

        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Dodaj usługę' }));
        const dialog = await screen.findByRole('dialog');
        const d = within(dialog);

        const nameInput = d.getByRole('textbox', { name: /Nazwa/i });
        const priceInput = d.getByRole('textbox', { name: /Cena \(zł\)/i });
        const durationInput = d.getByRole('textbox', { name: /Czas \(min\)/i });

        // Wypełniamy minimalnie tak, aby przejść lokalną walidację i dotrzeć do create()
        await user.type(nameInput, 'X');
        await user.clear(priceInput);
        await user.type(priceInput, '10');
        await user.clear(durationInput);
        await user.type(durationInput, '30');

        await user.click(d.getByRole('button', { name: 'Zapisz' }));

        // Alert pokazuje błąd (z backendu)
        const alert = await d.findByRole('alert');
        expect(alert).toHaveTextContent('To pole jest wymagane.');

        // helperText konkretnego pola "Nazwa"
        const helper = getHelperTextEl(nameInput);
        expect(helper).toHaveTextContent('To pole jest wymagane.');

        expect(servicesApi.create).toHaveBeenCalledTimes(1);
    });

    it('gdy list() rzuci błąd z detail -> pokazuje Alert z tą wiadomością (odporność na 500/itp)', async () => {
        vi.mocked(servicesApi.list).mockRejectedValue({
            response: {
                data: {
                    detail: 'Błąd',
                },
            },
        });

        renderPage();

        expect(await screen.findByRole('alert')).toHaveTextContent('Błąd');
    });
});
