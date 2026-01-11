import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthProvider, useAuth } from './AuthContext';
import { authApi } from '@/api/auth';
import type { User } from '@/types';

vi.mock('@/api/auth', () => {
    return {
        authApi: {
            getCsrf: vi.fn(),
            getStatus: vi.fn(),
            login: vi.fn(),
            logout: vi.fn(),
        },
    };
});

function makeUser(role: 'ADMIN' | 'EMPLOYEE' | 'CLIENT'): User {
    return {
        id: 1,
        username: 'u',
        first_name: 'Jan',
        last_name: 'Kowalski',
        email: 'u@example.com',
        role,
        role_display: role,
        is_active: true,
        employee_profile: null,
        client_profile: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
    };
}

/**
 * TestComponent jest tylko obserwatorem kontraktu contextu:
 * - loading/user
 * - flagi ról
 * - możliwość wywołania login/logout
 *
 * Nie testujemy UI, tylko zachowanie warstwy kontekstu.
 */
function TestComponent() {
    const { user, login, logout, loading, isAdmin, isEmployee, isClient } = useAuth();

    return (
        <div>
            <div data-testid="loading">{loading ? 'true' : 'false'}</div>
            <div data-testid="user">{user ? user.username : 'brak'}</div>
            <div data-testid="roles">
                {isAdmin ? 'admin' : ''} {isEmployee ? 'employee' : ''} {isClient ? 'client' : ''}
            </div>

            <button type="button" onClick={() => void login({ username: 'test', password: 'test' })}>
                LOGIN
            </button>

            {/* łapiemy reject, żeby nie generować Unhandled Rejection */}
            <button
                type="button"
                onClick={() => {
                    void logout().catch(() => {});
                }}
            >
                LOGOUT
            </button>
        </div>
    );
}

function renderAuth() {
    return render(
        <AuthProvider>
            <TestComponent />
        </AuthProvider>,
    );
}

describe('context/AuthContext (inżynierskie dowody kontraktu)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('init: woła getCsrf() i potem getStatus(); finalnie loading=false', async () => {
        // Nie zgadujemy payloadów - wystarczy, że resolve
        vi.mocked(authApi.getCsrf).mockResolvedValue(undefined);
        vi.mocked(authApi.getStatus).mockResolvedValue({
            isAuthenticated: false,
            user: null,
        });

        renderAuth();

        expect(screen.getByTestId('loading').textContent).toBe('true');

        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false');
        });

        expect(authApi.getCsrf).toHaveBeenCalledTimes(1);
        expect(authApi.getStatus).toHaveBeenCalledTimes(1);

        // Dowód inżynierski: kolejność side-effectów w init (CSRF przed status)
        const csrfOrder = vi.mocked(authApi.getCsrf).mock.invocationCallOrder[0];
        const statusOrder = vi.mocked(authApi.getStatus).mock.invocationCallOrder[0];
        expect(csrfOrder).toBeLessThan(statusOrder);
    });

    it('init: gdy isAuthenticated=true -> ustawia user oraz flagi roli', async () => {
        vi.mocked(authApi.getCsrf).mockResolvedValue(undefined);
        vi.mocked(authApi.getStatus).mockResolvedValue({
            isAuthenticated: true,
            user: makeUser('ADMIN'),
        });

        renderAuth();

        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

        expect(screen.getByTestId('user').textContent).toBe('u');
        expect(screen.getByTestId('roles').textContent).toContain('admin');
        expect(screen.getByTestId('roles').textContent).not.toContain('employee');
        expect(screen.getByTestId('roles').textContent).not.toContain('client');
    });

    it('init: gdy isAuthenticated=false -> user=null i brak flag ról', async () => {
        vi.mocked(authApi.getCsrf).mockResolvedValue(undefined);
        vi.mocked(authApi.getStatus).mockResolvedValue({
            isAuthenticated: false,
            user: null,
        });

        renderAuth();

        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

        expect(screen.getByTestId('user').textContent).toBe('brak');
        // Dowód: brak flag
        expect(screen.getByTestId('roles').textContent).not.toContain('admin');
        expect(screen.getByTestId('roles').textContent).not.toContain('employee');
        expect(screen.getByTestId('roles').textContent).not.toContain('client');
    });

    it('login(): robi getCsrf -> authApi.login(username,password) -> refreshUser(getStatus) i finalnie ustawia user', async () => {
        vi.mocked(authApi.getCsrf).mockResolvedValue(undefined);

        // init: 1. status -> niezalogowany
        vi.mocked(authApi.getStatus).mockResolvedValueOnce({
            isAuthenticated: false,
            user: null,
        });

        // po login: 2. status -> zalogowany
        vi.mocked(authApi.getStatus).mockResolvedValueOnce({
            isAuthenticated: true,
            user: makeUser('EMPLOYEE'),
        });

        vi.mocked(authApi.login).mockResolvedValue(undefined);

        renderAuth();

        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
        expect(screen.getByTestId('user').textContent).toBe('brak');

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'LOGIN' }));

        await waitFor(() => {
            expect(authApi.login).toHaveBeenCalledTimes(1);
            expect(authApi.login).toHaveBeenCalledWith('test', 'test');
            expect(screen.getByTestId('user').textContent).toBe('u');
            expect(screen.getByTestId('roles').textContent).toContain('employee');
        });

        // getCsrf: init + login
        expect(authApi.getCsrf).toHaveBeenCalledTimes(2);
        // getStatus: init + refreshUser po login
        expect(authApi.getStatus).toHaveBeenCalledTimes(2);

        // Dowód inżynierski: w ramach loginu getCsrf (2) musi zajść przed login()
        const csrfOrders = vi.mocked(authApi.getCsrf).mock.invocationCallOrder;
        const loginOrders = vi.mocked(authApi.login).mock.invocationCallOrder;
        expect(csrfOrders.length).toBe(2);
        expect(loginOrders.length).toBe(1);
        expect(csrfOrders[1]).toBeLessThan(loginOrders[0]);

        // Dowód: refreshUser po login -> getStatus(2) następuje po login()
        const statusOrders = vi.mocked(authApi.getStatus).mock.invocationCallOrder;
        expect(statusOrders.length).toBe(2);
        expect(loginOrders[0]).toBeLessThan(statusOrders[1]);
    });

    it('logout(): czyści user lokalnie nawet jeśli authApi.logout rzuci błąd', async () => {
        vi.mocked(authApi.getCsrf).mockResolvedValue(undefined);
        vi.mocked(authApi.getStatus).mockResolvedValue({
            isAuthenticated: true,
            user: makeUser('CLIENT'),
        });

        vi.mocked(authApi.logout).mockRejectedValue(new Error('boom'));

        renderAuth();

        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
        expect(screen.getByTestId('user').textContent).toBe('u');
        expect(screen.getByTestId('roles').textContent).toContain('client');

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'LOGOUT' }));

        await waitFor(() => {
            expect(screen.getByTestId('user').textContent).toBe('brak');
        });

        expect(authApi.logout).toHaveBeenCalledTimes(1);
        // Dowód: czyszczenie user nie zależy od sukcesu backendu logout.
    });
});
