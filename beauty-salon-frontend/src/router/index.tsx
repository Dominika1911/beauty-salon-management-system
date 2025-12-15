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
import { MySchedulePage } from '../pages/Employee/MySchedulePage';

import { AppointmentsManagementPage } from '../pages/Manager/AppointmentsManagementPage';
import { MyAppointmentsPage } from '../pages/MyAppointmentsPage.tsx';

import { PaymentsPage } from '../pages/Manager/PaymentsPage';
import { PaymentDetailsPage } from '../pages/Manager/PaymentDetailsPage';

import { InvoicesPage } from '../pages/Manager/InvoicesPage';
import { InvoiceDetailsPage } from '../pages/Manager/InvoiceDetailsPage';

import { NotificationsPage } from '../pages/Manager/NotificationsPage';

import { ScheduleManagementPage } from '../pages/Manager/ScheduleManagementPage';

// ✅ FIX: te pliki mają default export
import ReportsPage from '../pages/Manager/ReportsPage';
import SystemLogsPage from '../pages/Manager/SystemLogsPage';

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

// ✅ FIX: typ dla ESLint (@typescript-eslint/typedef)
const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      // ✅ Public
      {
        index: true,
        element: <PublicHomePage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },

      // ✅ Protected - dashboard
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },

      // ✅ Profile
      {
        path: 'profile',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },

      // ✅ My appointments
      {
        path: 'my-appointments',
        element: (
          <ProtectedRoute allowedRoles={['client']}>
            <MyAppointmentsPage />
          </ProtectedRoute>
        ),
      },

      // ✅ Employee only
      {
        path: 'my-schedule',
        element: (
          <ProtectedRoute allowedRoles={['employee']}>
            <MySchedulePage />
          </ProtectedRoute>
        ),
      },

      // ✅ Manager only - clients
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

      // ✅ Manager only - employees
      {
        path: 'employees-management',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <EmployeesManagementPage />
          </ProtectedRoute>
        ),
      },

      // ✅ Manager only - appointments calendar / management
      {
        path: 'appointments',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <AppointmentsCalendarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'appointments-management',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <AppointmentsManagementPage />
          </ProtectedRoute>
        ),
      },

      // SETTINGS
      {
        path: 'settings',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <SettingsPage />
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

      // ✅ STATYSTYKI (manager)
      {
        path: 'statistics',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <StatisticsPage />
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
