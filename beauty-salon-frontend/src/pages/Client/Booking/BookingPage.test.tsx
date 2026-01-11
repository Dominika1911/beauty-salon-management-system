import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import BookingPage from './BookingPage';
import { servicesApi } from '@/api/services';
import { employeesApi } from '@/api/employees';
import { appointmentsApi } from '@/api/appointments';
import type { DRFPaginated, Service } from '@/types';

vi.mock('@/api/services', () => ({
    servicesApi: {
        list: vi.fn(),
    },
}));

vi.mock('@/api/employees', () => ({
    employeesApi: {
        list: vi.fn(),
    },
}));

vi.mock('@/api/appointments', () => ({
    appointmentsApi: {
        getAvailableSlots: vi.fn(),
        book: vi.fn(),
    },
}));

describe('pages/Client/Booking/BookingPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pokazuje loader, a potem renderuje krok "Wybierz usługę" i listę usług z servicesApi.list(results)', async () => {
        const payload: DRFPaginated<Service> = {
            count: 2,
            next: null,
            previous: null,
            results: [
                {
                    id: 1,
                    name: 'Strzyżenie',
                    category: '',
                    description: '',
                    price: '50.00',
                    duration_minutes: 30,
                    duration_display: '30 min',
                    is_active: true,
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                },
                {
                    id: 2,
                    name: 'Manicure',
                    category: '',
                    description: '',
                    price: '70.00',
                    duration_minutes: 45,
                    duration_display: '45 min',
                    is_active: true,
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                },
            ],
        };

        vi.mocked(servicesApi.list).mockResolvedValue(payload);

        render(
            <MemoryRouter initialEntries={['/client/booking']}>
                <BookingPage />
            </MemoryRouter>,
        );

        expect(await screen.findByText('Rezerwacja wizyty')).toBeInTheDocument();

        expect(screen.getByText('Wybierz usługę')).toBeInTheDocument();
        expect(screen.getByText('Wybierz specjalistę')).toBeInTheDocument();
        expect(screen.getByText('Termin wizyty')).toBeInTheDocument();

        expect(screen.getByText('Strzyżenie')).toBeInTheDocument();
        expect(screen.getByText('Manicure')).toBeInTheDocument();

        await waitFor(() => {
            expect(servicesApi.list).toHaveBeenCalledWith({ is_active: true });
        });
    });

    it('gdy pobranie usług się nie uda -> pokazuje Alert z komunikatem z getErrorMessage(parseDrfError)', async () => {
        vi.mocked(servicesApi.list).mockRejectedValue({
            response: { data: { detail: 'Błąd' } },
        });

        render(
            <MemoryRouter initialEntries={['/client/booking']}>
                <BookingPage />
            </MemoryRouter>,
        );

        expect(await screen.findByText('Rezerwacja wizyty')).toBeInTheDocument();

        const alert = await screen.findByRole('alert');
        expect(within(alert).getByText('Błąd')).toBeInTheDocument();

        expect(screen.queryByText('Strzyżenie')).not.toBeInTheDocument();
    });
});
