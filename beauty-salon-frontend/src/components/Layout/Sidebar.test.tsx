import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Sidebar from './Sidebar';
import { useAuth } from '@/context/AuthContext';
import type { User, UserRole } from '@/types';

declare global {
    var __TEST_IS_MOBILE__: boolean | undefined;
}

const navigateMock = vi.fn();

function setIsMobile(v: boolean) {
    globalThis.__TEST_IS_MOBILE__ = v;
}

vi.mock('@/context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock('@mui/material', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@mui/material')>();

    return {
        ...actual,
        useMediaQuery: () => Boolean(globalThis.__TEST_IS_MOBILE__),
        Drawer: ({
            children,
            variant,
        }: {
            children: React.ReactNode;
            variant: 'temporary' | 'permanent' | string;
        }) => {
            const isMobile = Boolean(globalThis.__TEST_IS_MOBILE__);
            if (isMobile) {
                if (variant !== 'temporary') return null;
                return <div data-testid="drawer">{children}</div>;
            }

            if (variant !== 'permanent') return null;
            return <div data-testid="drawer">{children}</div>;
        },
    };
});

function makeUser(role: UserRole): User {
    const name =
        role === 'ADMIN' ? { first: 'Ada', last: 'Admin', display: 'Administrator' }
        : role === 'EMPLOYEE' ? { first: 'Ewa', last: 'Pracownik', display: 'Pracownik' }
        : { first: 'Klaudia', last: 'Klient', display: 'Klient' };

    return {
        id: 1,
        username: 'user',
        first_name: name.first,
        last_name: name.last,
        email: 'user@example.com',
        role,
        role_display: name.display,
        is_active: true,
        employee_profile: null,
        client_profile: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
    };
}

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
        isAuthenticated: false,
        isAdmin: false,
        isEmployee: false,
        isClient: false,
        ...overrides,
    } satisfies Partial<ReturnType<typeof useAuth>>);
}

function renderSidebar(pathname = '/dashboard', onMobileClose = vi.fn()) {
    return {
        onMobileClose,
        ...render(
            <MemoryRouter initialEntries={[pathname]}>
                <Sidebar mobileOpen={true} onMobileClose={onMobileClose} />
            </MemoryRouter>,
        ),
    };
}

describe('Sidebar – RBAC (menu per rola) + mobile close + logout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setIsMobile(false);
        navigateMock.mockReset();
        globalThis.__TEST_IS_MOBILE__ = false;
    });

    it('gdy user=null -> Sidebar renderuje null (brak drawer)', () => {
        mockAuth({
            user: null,
            logout: vi.fn(),
            isAuthenticated: false,
        });

        renderSidebar('/dashboard');

        expect(screen.queryByTestId('drawer')).toBeNull();
        expect(screen.queryByText('Nawigacja')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Wyloguj' })).toBeNull();
    });

    it('ADMIN widzi dokładnie swoje menu (zgodne z menuItems) + dane użytkownika', () => {
        mockAuth({
            user: makeUser('ADMIN'),
            logout: vi.fn().mockResolvedValue(undefined),
            isAuthenticated: true,
            isAdmin: true,
        });

        renderSidebar('/admin/services');

        const drawer = screen.getByTestId('drawer');
        const d = within(drawer);

        expect(d.getByText('Ada Admin')).toBeInTheDocument();
        expect(d.getByText('Administrator')).toBeInTheDocument();
        expect(d.getByText('Dashboard')).toBeInTheDocument();
        expect(d.getByText('Moje konto')).toBeInTheDocument();
        expect(d.getByText('Wizyty')).toBeInTheDocument();
        expect(d.getByText('Pracownicy')).toBeInTheDocument();
        expect(d.getByText('Grafiki')).toBeInTheDocument();
        expect(d.getByText('Klienci')).toBeInTheDocument();
        expect(d.getByText('Usługi')).toBeInTheDocument();
        expect(d.getByText('Statystyki')).toBeInTheDocument();
        expect(d.getByText('Raporty')).toBeInTheDocument();
        expect(d.getByText('Ustawienia')).toBeInTheDocument();
        expect(d.getByText('Logi')).toBeInTheDocument();
        expect(d.getByText('Urlopy')).toBeInTheDocument();
        expect(d.queryByText('Terminarz')).not.toBeInTheDocument();
        expect(d.queryByText('Moje wizyty')).not.toBeInTheDocument();
        expect(d.queryByText('Grafik')).not.toBeInTheDocument();
        expect(d.queryByText('Rezerwacja')).not.toBeInTheDocument();
    });

    it('EMPLOYEE widzi dokładnie swoje menu (zgodne z menuItems) + dane użytkownika', () => {
        mockAuth({
            user: makeUser('EMPLOYEE'),
            logout: vi.fn().mockResolvedValue(undefined),
            isAuthenticated: true,
            isEmployee: true,
        });

        renderSidebar('/employee/calendar');

        const drawer = screen.getByTestId('drawer');
        const d = within(drawer);

        expect(d.getByText('Ewa Pracownik')).toBeInTheDocument();
        expect(d.getByText('Pracownik')).toBeInTheDocument();

        expect(d.getByText('Dashboard')).toBeInTheDocument();
        expect(d.getByText('Moje konto')).toBeInTheDocument();

        expect(d.getByText('Terminarz')).toBeInTheDocument();
        expect(d.getByText('Moje wizyty')).toBeInTheDocument();
        expect(d.getByText('Grafik')).toBeInTheDocument();
        expect(d.getByText('Urlopy')).toBeInTheDocument();

        expect(d.queryByText('Pracownicy')).not.toBeInTheDocument();
        expect(d.queryByText('Klienci')).not.toBeInTheDocument();
        expect(d.queryByText('Usługi')).not.toBeInTheDocument();

        expect(d.queryByText('Rezerwacja')).not.toBeInTheDocument();
    });

    it('CLIENT widzi dokładnie swoje menu (zgodne z menuItems) + dane użytkownika', () => {
        mockAuth({
            user: makeUser('CLIENT'),
            logout: vi.fn().mockResolvedValue(undefined),
            isAuthenticated: true,
            isClient: true,
        });

        renderSidebar('/client/booking');

        const drawer = screen.getByTestId('drawer');
        const d = within(drawer);

        expect(d.getByText('Klaudia Klient')).toBeInTheDocument();
        expect(d.getByText('Klient')).toBeInTheDocument();

        expect(d.getByText('Dashboard')).toBeInTheDocument();
        expect(d.getByText('Moje konto')).toBeInTheDocument();

        expect(d.getByText('Rezerwacja')).toBeInTheDocument();
        expect(d.getByText('Moje wizyty')).toBeInTheDocument();

        expect(d.queryByText('Pracownicy')).not.toBeInTheDocument();
        expect(d.queryByText('Usługi')).not.toBeInTheDocument();

        expect(d.queryByText('Terminarz')).not.toBeInTheDocument();
        expect(d.queryByText('Grafik')).not.toBeInTheDocument();
    });

    it('mobile: klik w element nawigacji wywołuje onMobileClose()', async () => {
        setIsMobile(true);

        mockAuth({
            user: makeUser('EMPLOYEE'),
            logout: vi.fn().mockResolvedValue(undefined),
            isAuthenticated: true,
            isEmployee: true,
        });

        const { onMobileClose } = renderSidebar('/employee/calendar');

        const drawer = screen.getByTestId('drawer');
        const d = within(drawer);

        await userEvent.setup().click(d.getByRole('link', { name: 'Dashboard' }));

        expect(onMobileClose).toHaveBeenCalledTimes(1);
    });

    it('wylogowanie: otwiera dialog, po potwierdzeniu wywołuje logout i nawigację do /login', async () => {
        const logoutMock = vi.fn().mockResolvedValue(undefined);

        mockAuth({
            user: makeUser('ADMIN'),
            logout: logoutMock,
            isAuthenticated: true,
            isAdmin: true,
        });

        renderSidebar('/dashboard');

        const user = userEvent.setup();
        const drawer = screen.getByTestId('drawer');
        const d = within(drawer);

        await user.click(d.getByRole('button', { name: 'Wyloguj' }));

        expect(screen.getByText('Wylogować się?')).toBeInTheDocument();
        expect(
            screen.getByText('Zostaniesz wylogowany z systemu. Czy na pewno chcesz kontynuować?'),
        ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Wyloguj' }));

        expect(logoutMock).toHaveBeenCalledTimes(1);
        expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });

    it('mobile: po wylogowaniu woła onMobileClose() (logika responsive w Sidebar)', async () => {
        setIsMobile(true);

        const logoutMock = vi.fn().mockResolvedValue(undefined);
        const onMobileClose = vi.fn();

        mockAuth({
            user: makeUser('ADMIN'),
            logout: logoutMock,
            isAuthenticated: true,
            isAdmin: true,
        });

        renderSidebar('/dashboard', onMobileClose);

        const user = userEvent.setup();
        const drawer = screen.getByTestId('drawer');
        const d = within(drawer);

        await user.click(d.getByRole('button', { name: 'Wyloguj' }));
        await user.click(screen.getByRole('button', { name: 'Wyloguj' }));

        expect(logoutMock).toHaveBeenCalledTimes(1);
        expect(onMobileClose).toHaveBeenCalledTimes(1);
        expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });
});
