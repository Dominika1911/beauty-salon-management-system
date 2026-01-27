import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import LoginPage from './LoginPage';
import { useAuth } from '@/context/AuthContext';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock('@/context/AuthContext', () => {
    return {
        useAuth: vi.fn(),
    };
});

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        login: vi.fn(),
        user: null,
        ...overrides,
    });
}

function getUsernameInput() {
    return screen.getByRole('textbox', { name: /Nazwa użytkownika/i });
}

function getPasswordInput() {
    // LoginPage.tsx ma label="Hasło" – to jest realny kontrakt UI
    return screen.getByLabelText(/Hasło/i);
}

describe('pages/LoginPage', () => {
    let warnSpy: ReturnType<typeof vi.spyOn> | null = null;
    let originalWarn: ((...args: any[]) => void) | null = null;

    beforeEach(() => {
        navigateMock.mockReset();
        (useAuth as unknown as ReturnType<typeof vi.fn>).mockReset();

        originalWarn = console.warn.bind(console);
        warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
            const msg = String(args[0] ?? '');
            if (msg.includes('React Router Future Flag Warning')) return;
            originalWarn?.(...args);
        });
    });

    afterEach(() => {
        warnSpy?.mockRestore();
        warnSpy = null;
        originalWarn = null;
    });

    it('renderuje formularz: nagłówek, pola i przycisk (bez getByText jako selektora)', () => {
        mockAuth();

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: 'Beauty Salon' })).toBeInTheDocument();

        expect(getUsernameInput()).toBeInTheDocument();
        expect(getPasswordInput()).toBeInTheDocument();

        expect(screen.getByRole('button', { name: 'Zaloguj się' })).toBeDisabled();
    });

    it('włącza submit dopiero gdy oba pola są uzupełnione (canSubmit)', async () => {
        mockAuth();

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        const user = userEvent.setup();

        const submit = screen.getByRole('button', { name: 'Zaloguj się' });
        expect(submit).toBeDisabled();

        await user.type(getUsernameInput(), 'user');
        expect(submit).toBeDisabled();

        await user.type(getPasswordInput(), 'pass');
        expect(submit).toBeEnabled();
    });

    it('wywołuje login({ username, password }) i w trakcie blokuje submit (loading)', async () => {
        let resolveLogin: (() => void) | null = null;

        const loginMock = vi.fn().mockImplementation(
            () =>
                new Promise<void>((res) => {
                    resolveLogin = () => res();
                }),
        );

        mockAuth({ login: loginMock });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        const user = userEvent.setup();

        await user.type(getUsernameInput(), 'user');
        await user.type(getPasswordInput(), 'pass');

        const submit = screen.getByRole('button', { name: 'Zaloguj się' });
        expect(submit).toBeEnabled();

        await user.click(submit);

        expect(loginMock).toHaveBeenCalledTimes(1);
        expect(loginMock).toHaveBeenCalledWith({ username: 'user', password: 'pass' });

        expect(submit).toBeDisabled();

        expect(resolveLogin).not.toBeNull();
        resolveLogin!();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Zaloguj się' })).toBeEnabled();
        });
    });

    it('blokuje wielokrotne logowanie: double click powoduje tylko 1 wywołanie login', async () => {
        let resolveLogin: (() => void) | null = null;

        const loginMock = vi.fn().mockImplementation(
            () =>
                new Promise<void>((res) => {
                    resolveLogin = () => res();
                }),
        );

        mockAuth({ login: loginMock });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        const user = userEvent.setup();

        await user.type(getUsernameInput(), 'user');
        await user.type(getPasswordInput(), 'pass');

        const submit = screen.getByRole('button', { name: 'Zaloguj się' });

        await user.dblClick(submit);

        expect(loginMock).toHaveBeenCalledTimes(1);
        expect(submit).toBeDisabled();

        expect(resolveLogin).not.toBeNull();
        resolveLogin!();
    });

    it('gdy login rzuci błąd z detail -> pokazuje Alert z tą wiadomością (tekst z mocka)', async () => {
        const loginMock = vi.fn().mockRejectedValue({
            response: { data: { detail: 'Nieprawidłowe dane.' } },
        });

        mockAuth({ login: loginMock });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        const user = userEvent.setup();

        await user.type(getUsernameInput(), 'user');
        await user.type(getPasswordInput(), 'pass');
        await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Nieprawidłowe dane.');
    });

    it('gdy login rzuci błąd pól -> mapuje je do helperText (ARIA opis pola)', async () => {
        const loginMock = vi.fn().mockRejectedValue({
            response: {
                data: {
                    username: ['Za krótka nazwa użytkownika.'],
                    password: ['Hasło jest za słabe.'],
                },
            },
        });

        mockAuth({ login: loginMock });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        const user = userEvent.setup();

        await user.type(getUsernameInput(), 'u');
        await user.type(getPasswordInput(), 'p');

        await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));

        expect(getUsernameInput()).toHaveAccessibleDescription('Za krótka nazwa użytkownika.');
        expect(getPasswordInput()).toHaveAccessibleDescription('Hasło jest za słabe.');
        expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('dla 401 pokazuje błąd i odblokowuje submit', async () => {
        const loginMock = vi.fn().mockRejectedValue({
            response: { status: 401, data: { detail: 'Unauthorized' } },
        });

        mockAuth({ login: loginMock });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        const user = userEvent.setup();

        await user.type(getUsernameInput(), 'user');
        await user.type(getPasswordInput(), 'pass');

        await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Zaloguj się' })).toBeEnabled();
        });
    });

    it('dla 403 pokazuje błąd i odblokowuje submit', async () => {
        const loginMock = vi.fn().mockRejectedValue({
            response: { status: 403, data: { detail: 'Forbidden' } },
        });

        mockAuth({ login: loginMock });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        const user = userEvent.setup();

        await user.type(getUsernameInput(), 'user');
        await user.type(getPasswordInput(), 'pass');

        await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Zaloguj się' })).toBeEnabled();
        });
    });

    it('dla 500 pokazuje błąd i odblokowuje submit', async () => {
        const loginMock = vi.fn().mockRejectedValue({
            response: { status: 500, data: { detail: 'Server error' } },
        });

        mockAuth({ login: loginMock });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        const user = userEvent.setup();

        await user.type(getUsernameInput(), 'user');
        await user.type(getPasswordInput(), 'pass');

        await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Zaloguj się' })).toBeEnabled();
        });
    });
});
