import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import BookingPage from './BookingPage';
import { servicesApi } from '@/api/services';
import { employeesApi } from '@/api/employees';
import type { DRFPaginated } from '@/types';

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

vi.mock('./components/ServiceStep', () => ({
    ServiceStep: ({ onPickService }: { onPickService: (s: { id: number; name: string }) => void }) => {
        return (
            <div>
                <div>__SERVICE_STEP__</div>
                <button type="button" onClick={() => onPickService({ id: 123, name: 'X' })}>
                    __PICK_SERVICE__
                </button>
            </div>
        );
    },
}));

vi.mock('./components/EmployeeStep', () => ({
    EmployeeStep: () => <div>__EMPLOYEE_STEP__</div>,
}));

vi.mock('./components/DateTimeStep', () => ({
    DateTimeStep: () => <div>__DATETIME_STEP__</div>,
}));

describe('pages/Client/Booking/BookingPage – flow (minimalny dowód kroku 0→1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('po wybraniu usługi: woła employeesApi.list({service_id}) i po kliknięciu "Dalej" renderuje krok "Wybierz specjalistę"', async () => {
        const servicesPayload: DRFPaginated<unknown> = {
            count: 0,
            next: null,
            previous: null,
            results: [],
        };

        vi.mocked(servicesApi.list).mockResolvedValue(servicesPayload);

        vi.mocked(employeesApi.list).mockResolvedValue({
            count: 0,
            next: null,
            previous: null,
            results: [],
        });

        render(
            <MemoryRouter initialEntries={['/client/booking']}>
                <BookingPage />
            </MemoryRouter>,
        );

        expect(await screen.findByText('Rezerwacja wizyty')).toBeInTheDocument();
        expect(screen.getByText('__SERVICE_STEP__')).toBeInTheDocument();

        await userEvent.setup().click(screen.getByRole('button', { name: '__PICK_SERVICE__' }));

        await waitFor(() => {
            expect(employeesApi.list).toHaveBeenCalledWith({ service_id: 123 });
        });

        await userEvent.setup().click(screen.getByTestId('booking-next'));

        expect(await screen.findByText('Wybierz specjalistę')).toBeInTheDocument();
        expect(screen.getByText('__EMPLOYEE_STEP__')).toBeInTheDocument();
    });
});
