import React from 'react';
import type { ReactElement } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// === KOMPONENTY OSŁONOWE I NAWIGACYJNE ===
import { Layout } from '../components/Layout/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';

// === KOMPONENTY STRON ===
import { DashboardPage } from '../pages/DashboardPage';
import { ClientsManagementPage } from '../pages/Manager/ClientsManagementPage';
import { EmployeesManagementPage } from '../pages/Manager/EmployeesManagementPage';
import { ServicesManagementPage } from '../pages/Manager/ServicesManagementPage';
import { AppointmentsCalendarPage } from '../pages/Manager/AppointmentsCalendarPage';
import StatisticsPage from "../pages/StatisticsPage";
import SettingsPage from "../pages/SettingsPage";


// DODANO: Strona dla Managera do zarządzania wszystkimi grafikami
import { ScheduleManagementPage } from '../pages/Manager/ScheduleManagementPage';
// DODANO: Strona dla Pracownika (wcześniej placeholder)
import { MySchedulePage } from '../pages/Employee/MySchedulePage';

import { AppointmentsManagementPage } from '../pages/Manager/AppointmentsManagementPage';
import { MyAppointmentsPage } from '../pages/Client/MyAppointmentsPage';


// Tymczasowe/Placeholdery
const ProfilePage: React.FC = (): ReactElement => <h1>Profil</h1>;


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
            <AppointmentsManagementPage />
          </ProtectedRoute>
        ),
      },
        {
        path: 'appointments-calendar',
        element: (
            <ProtectedRoute allowedRoles={['manager', 'employee']}>
                 <AppointmentsCalendarPage />
            </ProtectedRoute>
        ),
      },

      // 🚨 ZMIENIONO: Użycie pełnej strony Pracownika dla Mój Grafik
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
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <ServicesManagementPage />
          </ProtectedRoute>
        ),
      },
      // 🚨 DODANO: Nowa ścieżka dla Managera do zarządzania grafikami wszystkich
      {
        path: 'schedule',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <ScheduleManagementPage />
          </ProtectedRoute>
        ),
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
          <ProtectedRoute allowedRoles={['manager', 'employee']}>
            <EmployeesManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'statistics',
        element: (
          <ProtectedRoute allowedRoles={['manager','employee']}>
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