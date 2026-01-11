import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import type { User, UserRole } from '@/types';

vi.mock('@/context/AuthContext', () => {
    return {
        useAuth: vi.fn(),
    };
});

function makeUser(role: UserRole): User {
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

type AuthMock = ReturnType<typeof useAuth>;

function mockAuth(value: Partial<AuthMock>) {
    vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
        ...value,
    });
}

function renderWithRoutes(
    ui: React.ReactNode,
    initialEntries: string[] = ['/protected'],
) {
    return render(
        <MemoryRouter initialEntries={initialEntries}>
            <Routes>
                <Route path="/protected" element={ui} />
                <Route path="/login" element={<div>LOGIN_PAGE</div>} />
                <Route path="/access-denied" element={<div>ACCESS_DENIED_PAGE</div>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('components/ProtectedRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('gdy loading=true -> nie renderuje children ani redirectów', () => {
        mockAuth({
            loading: true,
            isAuthenticated: false,
        });

        renderWithRoutes(
            <ProtectedRoute>
                <div>SECRET</div>
            </ProtectedRoute>,
        );

        // spinner jest jedynym renderem
        expect(screen.getByRole('progressbar')).toBeInTheDocument();

        expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
        expect(screen.queryByText('LOGIN_PAGE')).not.toBeInTheDocument();
        expect(screen.queryByText('ACCESS_DENIED_PAGE')).not.toBeInTheDocument();
    });

    it('gdy isAuthenticated=false -> redirect do /login', () => {
        mockAuth({
            user: null,
            loading: false,
            isAuthenticated: false,
        });

        renderWithRoutes(
            <ProtectedRoute>
                <div>SECRET</div>
            </ProtectedRoute>,
        );

        expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
        expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
    });

    it('gdy rola nie jest dozwolona -> redirect do /access-denied', () => {
        mockAuth({
            user: makeUser('CLIENT'),
            isAuthenticated: true,
        });

        renderWithRoutes(
            <ProtectedRoute allowedRoles={['ADMIN']}>
                <div>SECRET</div>
            </ProtectedRoute>,
        );

        expect(screen.getByText('ACCESS_DENIED_PAGE')).toBeInTheDocument();
        expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
    });

    it('gdy rola jest dozwolona -> renderuje children', () => {
        mockAuth({
            user: makeUser('ADMIN'),
            isAuthenticated: true,
        });

        renderWithRoutes(
            <ProtectedRoute allowedRoles={['ADMIN', 'EMPLOYEE']}>
                <div>SECRET</div>
            </ProtectedRoute>,
        );

        expect(screen.getByText('SECRET')).toBeInTheDocument();
        expect(screen.queryByText('LOGIN_PAGE')).not.toBeInTheDocument();
        expect(screen.queryByText('ACCESS_DENIED_PAGE')).not.toBeInTheDocument();
    });
});
