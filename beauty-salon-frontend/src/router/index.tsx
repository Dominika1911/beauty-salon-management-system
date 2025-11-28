// src/router/index.tsx

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'appointments',
        element: (
          <ProtectedRoute>
            <div>
              <h1>Wizyty</h1>
              <p>Strona w budowie...</p>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: 'clients',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee']}>
            <div>
              <h1>Klienci</h1>
              <p>Strona w budowie...</p>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: 'employees',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <div>
              <h1>Pracownicy</h1>
              <p>Strona w budowie...</p>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: 'services',
        element: (
          <ProtectedRoute>
            <div>
              <h1>Usługi</h1>
              <p>Strona w budowie...</p>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: 'statistics',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <div>
              <h1>Statystyki</h1>
              <p>Strona w budowie...</p>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <div>
              <h1>Ustawienia</h1>
              <p>Strona w budowie...</p>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-schedule',
        element: (
          <ProtectedRoute allowedRoles={['employee']}>
            <div>
              <h1>Mój grafik</h1>
              <p>Strona w budowie...</p>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-appointments',
        element: (
          <ProtectedRoute allowedRoles={['client']}>
            <div>
              <h1>Moje wizyty</h1>
              <p>Strona w budowie...</p>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <div>
              <h1>Profil</h1>
              <p>Strona w budowie...</p>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <h1>404</h1>
            <p>Strona nie znaleziona</p>
          </div>
        ),
      },
    ],
  },
]);