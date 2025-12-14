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
import StatisticsPage from '../pages/StatisticsPage';
import SettingsPage from '../pages/SettingsPage';

// Manager: raporty + logi
import ReportsPage from '../pages/Manager/ReportsPage';
import AuditLogsPage from '../pages/Manager/AuditLogsPage';

// Manager: grafiki wszystkich
import { ScheduleManagementPage } from '../pages/Manager/ScheduleManagementPage';
// Employee: mój grafik
import { MySchedulePage } from '../pages/Employee/MySchedulePage';

import { AppointmentsManagementPage } from '../pages/Manager/AppointmentsManagementPage';
import { MyAppointmentsPage } from '../pages/Client/MyAppointmentsPage';
import { BookAppointmentPage } from '../pages/Client/BookAppointmentPage';


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

      // Employee: mój grafik
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

      // Manager: zarządzanie grafikami wszystkich
      {
        path: 'schedule',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <ScheduleManagementPage />
          </ProtectedRoute>
        ),
      },

      //  Manager-only: raporty + logi
      {
        path: 'reports',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit-logs',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <AuditLogsPage />
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
            path: 'book',
            element: (
                <ProtectedRoute allowedRoles={['client']}>
                    <BookAppointmentPage />
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
          <ProtectedRoute allowedRoles={['manager', 'employee']}>
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
