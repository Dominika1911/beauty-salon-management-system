import React from 'react';
import type { ReactElement } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// === KOMPONENTY OSŁONOWE I NAWIGACYJNE ===
import { Layout } from '../components/Layout/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';

// === KOMPONENTY STRON ===
import { DashboardPage } from '../pages/DashboardPage';

// Placeholder components
const ClientsPage: React.FC = (): ReactElement => <h1>Klienci</h1>;
const EmployeesPage: React.FC = (): ReactElement => <h1>Pracownicy</h1>;
const ServicesPage: React.FC = (): ReactElement => <h1>Usługi</h1>;
const AppointmentsPage: React.FC = (): ReactElement => <h1>Wizyty</h1>;
const MySchedulePage: React.FC = (): ReactElement => <h1>Mój Grafik</h1>;
const MyAppointmentsPage: React.FC = (): ReactElement => <h1>Moje Wizyty</h1>;
const ProfilePage: React.FC = (): ReactElement => <h1>Profil</h1>;
const StatisticsPage: React.FC = (): ReactElement => <h1>Statystyki</h1>;
const SettingsPage: React.FC = (): ReactElement => <h1>Ustawienia</h1>;

// === DEKLARACJA GŁÓWNEGO ROUTERA ===
const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  // 1. TRASY PUBLICZNE
  {
    path: '/login',
    element: <LoginPage />,
  },

  // 2. TRASY CHRONIONE (ZAGNIEŻDŻONE W LAYOUT)
  {
    path: '/',
    element: <Layout />,
    children: [
      // TRASA GŁÓWNA (/): Przekierowanie na Dashboard
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },

      // DASHBOARD (Dostęp dla wszystkich zalogowanych)
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },

      // KLIENCI (Manager, Pracownik)
      {
        path: 'clients',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee']}>
            <ClientsPage />
          </ProtectedRoute>
        ),
      },

      // WIZYTY (Manager, Pracownik)
      {
        path: 'appointments',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee']}>
            <AppointmentsPage />
          </ProtectedRoute>
        ),
      },

      // GRAFIK PRACOWNIKA (Tylko Pracownik)
      {
        path: 'my-schedule',
        element: (
          <ProtectedRoute allowedRoles={['employee']}>
            <MySchedulePage />
          </ProtectedRoute>
        ),
      },

      // USŁUGI (Wszyscy zalogowani)
      {
        path: 'services',
        element: <ServicesPage />,
      },

      // MOJE WIZYTY (Tylko Klient)
      {
        path: 'my-appointments',
        element: (
          <ProtectedRoute allowedRoles={['client']}>
            <MyAppointmentsPage />
          </ProtectedRoute>
        ),
      },

      // PRACOWNICY (Tylko Manager)
      {
        path: 'employees',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <EmployeesPage />
          </ProtectedRoute>
        ),
      },

      // STATYSTYKI I USTAWIENIA (Tylko Manager)
      {
        path: 'statistics',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <StatisticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },

      // TRASA 404 (wyświetlana wewnątrz Layoutu)
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

  // Trasa 404 dla ścieżek bez Layoutu
  {
    path: '/404',
    element: <h1>404 Strona nie znaleziona</h1>,
  },
]);

// Komponent do użycia w pliku main.tsx
export const AppRouter: React.FC = (): ReactElement => {
  return <RouterProvider router={router} />;
};

export default AppRouter;