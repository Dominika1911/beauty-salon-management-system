import React from 'react';
import type { ReactElement } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// === KOMPONENTY OSŁONOWE I NAWIGACYJNE ===
import { Layout } from '../components/Layout/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';

// === KOMPONENTY STRON (IMPORTUJEMY PRAWDZIWE STRONY) ===
import { DashboardPage } from '../pages/DashboardPage';
import { ClientsManagementPage } from '../pages/Manager/ClientsManagementPage';
import { EmployeesManagementPage } from '../pages/Manager/EmployeesManagementPage';




const ServicesPage: React.FC = (): ReactElement => <h1>Usługi</h1>;
const AppointmentsPage: React.FC = (): ReactElement => <h1>Wizyty</h1>;
const MySchedulePage: React.FC = (): ReactElement => <h1>Mój Grafik</h1>;
const MyAppointmentsPage: React.FC = (): ReactElement => <h1>Moje Wizyty</h1>;
const ProfilePage: React.FC = (): ReactElement => <h1>Profil</h1>;
const StatisticsPage: React.FC = (): ReactElement => <h1>Statystyki</h1>;
const SettingsPage: React.FC = (): ReactElement => <h1>Ustawienia</h1>;


const router = createBrowserRouter([
  // PUBLICZNE
  {
    path: '/login',
    element: <LoginPage />,
  },

  // CHRONIONE
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'clients',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee']}>
            <ClientsManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'appointments',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee']}>
            <AppointmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-schedule',
        element: (
          <ProtectedRoute allowedRoles={['employee']}>
            <MySchedulePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'services',
        element: <ServicesPage />,
      },
      {
        path: 'my-appointments',
        element: (
          <ProtectedRoute allowedRoles={['client']}>
            <MyAppointmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employees',
        element: (
          // ZMIANA: Dodano 'employee' do ról i użyto prawdziwej strony
          <ProtectedRoute allowedRoles={['manager', 'employee']}>
            <EmployeesManagementPage />
          </ProtectedRoute>
        ),
      },
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
  {
    path: '/404',
    element: <h1>404 Strona nie znaleziona</h1>,
  },
]);

export const AppRouter: React.FC = (): ReactElement => {
  return <RouterProvider router={router} />;
};

export default AppRouter;