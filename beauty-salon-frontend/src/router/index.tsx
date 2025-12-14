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
import { ClientDetailsPage } from '../pages/Manager/ClientDetailsPage';
import { EmployeesManagementPage } from '../pages/Manager/EmployeesManagementPage';
import { ServicesManagementPage } from '../pages/Manager/ServicesManagementPage';
import { AppointmentsCalendarPage } from '../pages/Manager/AppointmentsCalendarPage';
import StatisticsPage from '../pages/StatisticsPage';
import SettingsPage from '../pages/SettingsPage';
import { ServicesCatalogPage } from '../pages/ServicesCatalogPage';
import { BookAppointmentPage } from '../pages/BookAppointmentPage';

// Manager: raporty + logi
import ReportsPage from '../pages/Manager/ReportsPage';
import AuditLogsPage from '../pages/Manager/AuditLogsPage';

// Manager: grafiki wszystkich
import { ScheduleManagementPage } from '../pages/Manager/ScheduleManagementPage';
// Employee: mój grafik
import { MySchedulePage } from '../pages/Employee/MySchedulePage';

import { AppointmentsManagementPage } from '../pages/Manager/AppointmentsManagementPage';
import { MyAppointmentsPage } from '../pages/MyAppointmentsPage.tsx';

// Payments
import { PaymentsPage } from '../pages/Manager/PaymentsPage';
import { PaymentDetailsPage } from '../pages/Manager/PaymentDetailsPage';

// ✅ Invoices
import { InvoicesPage } from '../pages/Manager/InvoicesPage';
import { InvoiceDetailsPage } from '../pages/Manager/InvoiceDetailsPage';

// ✅ Notifications
import { NotificationsPage } from '../pages/Manager/NotificationsPage';

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

      // === MANAGER ONLY ===
      {
        path: 'clients',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <ClientsManagementPage />
          </ProtectedRoute>
        ),
      },

      // ✅ DOPIĘTE: SZCZEGÓŁY KLIENTA (bo /clients/:id było używane, ale nie miało route)
      {
        path: 'clients/:id',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <ClientDetailsPage />
          </ProtectedRoute>
        ),
      },

      // ✅ MANAGER: PAYMENTS
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

      // ✅ MANAGER: INVOICES
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

      // ✅ MANAGER: NOTIFICATIONS
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

      // === EMPLOYEE ONLY ===
      {
        path: 'my-schedule',
        element: (
          <ProtectedRoute allowedRoles={['employee']}>
            <MySchedulePage />
          </ProtectedRoute>
        ),
      },

      // === WSPÓLNE ===
      {
        path: 'services',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <ServicesManagementPage />
          </ProtectedRoute>
        ),
      },

      // === MANAGER ONLY ===
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
        path: 'audit-logs',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <AuditLogsPage />
          </ProtectedRoute>
        ),
      },

      // === CLIENT ONLY ===
      {
        path: 'book',
        element: (
          <ProtectedRoute allowedRoles={['client']}>
            <BookAppointmentPage />
          </ProtectedRoute>
        ),
      },

      {
        path: 'services',
        element: (
          <ProtectedRoute allowedRoles={['client']}>
            <ServicesCatalogPage />
          </ProtectedRoute>
        ),
      },

      // === MANAGER ONLY ===
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
