import React from 'react';
import type { ReactElement } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// === OSŁONA / LAYOUT ===
import { Layout } from '../components/Layout/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';

// === HOOK ===
import { useAuth } from '../hooks/useAuth';

// ✅ PUBLIC HOME
import { PublicHomePage } from '../pages/PublicHomePage';

// === STRONY ===
import { DashboardPage } from '../pages/DashboardPage';
import { ClientsManagementPage } from '../pages/Manager/ClientsManagementPage';
import { ClientDetailsPage } from '../pages/Manager/ClientDetailsPage';
import { EmployeesManagementPage } from '../pages/Manager/EmployeesManagementPage';
import { ServicesManagementPage } from '../pages/Manager/ServicesManagementPage';
import { AppointmentsCalendarPage } from '../pages/Manager/AppointmentsCalendarPage';
import StatisticsPage from '../pages/StatisticsPage';
import SettingsPage from '../pages/SettingsPage';
import { ServicesCatalogPage } from '../pages/ServicesCatalogPage';
import { BookAppointmentPage } from '../pages/BookAppointmentPage';

import ReportsPage from '../pages/Manager/ReportsPage';
import SystemLogsPage from '../pages/Manager/SystemLogsPage';

import { ScheduleManagementPage } from '../pages/Manager/ScheduleManagementPage';
import { MySchedulePage } from '../pages/Employee/MySchedulePage';

import { AppointmentsManagementPage } from '../pages/Manager/AppointmentsManagementPage';
import { MyAppointmentsPage } from '../pages/MyAppointmentsPage.tsx';

import { PaymentsPage } from '../pages/Manager/PaymentsPage';
import { PaymentDetailsPage } from '../pages/Manager/PaymentDetailsPage';

import { InvoicesPage } from '../pages/Manager/InvoicesPage';
import { InvoiceDetailsPage } from '../pages/Manager/InvoiceDetailsPage';

import { NotificationsPage } from '../pages/Manager/NotificationsPage';

// Placeholder
const ProfilePage: React.FC = (): ReactElement => <h1>Profil</h1>;

// ✅ route zależny od roli
const ServicesRoutePage: React.FC = (): ReactElement => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'client') {
    return <ServicesCatalogPage />;
  }

  return <ServicesManagementPage />;
};

const router = createBrowserRouter([
  // PUBLICZNE
  {
    path: '/login',
    element: <LoginPage />,
  },

  // ✅ ROOT: / ma PublicHomePage jako index, a PANEL jest w child z Layoutem
  {
    path: '/',
    children: [
      // ✅ strona domyślna: /
      {
        index: true,
        element: <PublicHomePage />,
      },

      // ✅ PANEL (z layoutem) – ale URL-e zostają /dashboard, /schedule itd.
      {
        path: '',
        element: <Layout />,
        children: [
          {
            path: 'dashboard',
            element: (
              <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
                <DashboardPage />
              </ProtectedRoute>
            ),
          },

          // === MANAGER ONLY ===
          {
            path: 'clients',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <ClientsManagementPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'clients/:id',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <ClientDetailsPage />
              </ProtectedRoute>
            ),
          },

          // PAYMENTS
          {
            path: 'payments',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <PaymentsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'payments/:id',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <PaymentDetailsPage />
              </ProtectedRoute>
            ),
          },

          // INVOICES
          {
            path: 'invoices',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <InvoicesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'invoices/:id',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <InvoiceDetailsPage />
              </ProtectedRoute>
            ),
          },

          // NOTIFICATIONS
          {
            path: 'notifications',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <NotificationsPage />
              </ProtectedRoute>
            ),
          },

          {
            path: 'appointments',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <AppointmentsManagementPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'my-appointments',
            element: (
              <ProtectedRoute allowedRoles={['client', 'employee']}>
                <MyAppointmentsPage />
              </ProtectedRoute>
            ),
          },

          {
            path: 'appointments-calendar',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <AppointmentsCalendarPage />
              </ProtectedRoute>
            ),
          },

          // EMPLOYEE ONLY
          {
            path: 'my-schedule',
            element: (
              <ProtectedRoute allowedRoles={['employee']}>
                <MySchedulePage />
              </ProtectedRoute>
            ),
          },

          // /services zależne od roli
          {
            path: 'services',
            element: (
              <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
                <ServicesRoutePage />
              </ProtectedRoute>
            ),
          },

          // MANAGER ONLY
          {
            path: 'schedule',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <ScheduleManagementPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <ReportsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'system-logs',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
                <SystemLogsPage />
              </ProtectedRoute>
            ),
          },

          // CLIENT ONLY
          {
            path: 'book',
            element: (
              <ProtectedRoute allowedRoles={['client']}>
                <BookAppointmentPage />
              </ProtectedRoute>
            ),
          },

          // MANAGER ONLY
          {
            path: 'employees',
            element: (
              <ProtectedRoute allowedRoles={['manager']}>
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

          // panel 404
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
