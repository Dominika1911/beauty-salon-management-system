import React from 'react';
import type { ReactElement } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

import { Layout } from '@/app/layout/Layout';
import { ProtectedRoute } from '@/app/router/ProtectedRoute';
import { useAuth } from '@/shared/hooks/useAuth';

import PublicHomePage from '@/pages/PublicHomePage';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';

import { BookAppointmentPage } from '@/pages/BookAppointmentPage';
import { MyAppointmentsPage } from '@/pages/MyAppointmentsPage';

import { MySchedulePage } from '@/pages/Employee/MySchedulePage';
import { MyProfilePage } from '@/pages/Employee/MyProfilePage';
import { MyAvailabilityPage } from '@/pages/Employee/MyAvailabilityPage';
import { MyTimeOffPage } from '@/pages/Employee/MyTimeOffPage';

import { ClientsManagementPage } from '@/pages/Manager/ClientsManagementPage';
import { ClientDetailsPage } from '@/pages/Manager/ClientDetailsPage';
import { EmployeesManagementPage } from '@/pages/Manager/EmployeesManagementPage';
import { ServicesManagementPage } from '@/pages/Manager/ServicesManagementPage';
import { AppointmentsManagementPage } from '@/pages/Manager/AppointmentsManagementPage';
import { AppointmentsCalendarPage } from '@/pages/Manager/AppointmentsCalendarPage';
import { PaymentsPage } from '@/pages/Manager/PaymentsPage';
import { PaymentDetailsPage } from '@/pages/Manager/PaymentDetailsPage';
import { InvoicesPage } from '@/pages/Manager/InvoicesPage';
import { InvoiceDetailsPage } from '@/pages/Manager/InvoiceDetailsPage';
import { NotificationsPage } from '@/pages/Manager/NotificationsPage';
import { ScheduleManagementPage } from '@/pages/Manager/ScheduleManagementPage';
import ReportsPage from '@/pages/Manager/ReportsPage';
import SystemLogsPage from '@/pages/Manager/SystemLogsPage';
import ManagerProfilePage from '@/pages/Manager/ManagerProfilePage';

import { ServicesCatalogPage } from '@/pages/ServicesCatalogPage';
import StatisticsPage from '@/pages/StatisticsPage';
import SettingsPage from '@/pages/SettingsPage';

import ClientMyProfilePage from '@/pages/Clients/MyProfilePage';


// import ForgotPasswordPage from '@/pages/ForgotPasswordPage'; // usunięto reset hasła


// route zależny od roli
/**
 * Komponent decydujący, którą wersję strony usług wyświetlić w zależności od roli użytkownika.
 *
 * Klienci oraz pracownicy powinni widzieć jedynie katalog usług (bez możliwości edycji),
 * natomiast menedżerowie mają dostęp do panelu zarządzania usługami.
 */
const ServicesRoutePage: React.FC = (): ReactElement => {
  const { user } = useAuth();

  // Jeśli użytkownik nie jest zalogowany – przekieruj do logowania
  if (!user) return <Navigate to="/login" replace />;

  // Manager ma pełny dostęp do zarządzania usługami
  if (user.role === 'manager') {
    return <ServicesManagementPage />;
  }

  // Klient oraz pracownik widzą katalog usług bez opcji zarządzania
  return <ServicesCatalogPage />;
};

const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <PublicHomePage /> },
      { path: 'login', element: <LoginPage /> },

      // Reset hasła usunięty – brak publicznej trasy

      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },

      // MANAGER profile
      {
        path: 'profile',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerProfilePage />
          </ProtectedRoute>
        ),
      },

      // EMPLOYEE profile
      {
        path: 'my-profile',
        element: (
          <ProtectedRoute allowedRoles={['employee']}>
            <MyProfilePage />
          </ProtectedRoute>
        ),
      },

      // EMPLOYEE availability
      {
        path: 'my-availability',
        element: (
          <ProtectedRoute allowedRoles={['employee']}>
            <MyAvailabilityPage />
          </ProtectedRoute>
        ),
      },

      // ✅ EMPLOYEE time off
      {
        path: 'my-time-off',
        element: (
          <ProtectedRoute allowedRoles={['employee']}>
            <MyTimeOffPage />
          </ProtectedRoute>
        ),
      },

      // My appointments (client + employee)
      {
        path: 'my-appointments',
        element: (
          <ProtectedRoute allowedRoles={['client', 'employee']}>
            <MyAppointmentsPage />
          </ProtectedRoute>
        ),
      },

      // Employee schedule
      {
        path: 'my-schedule',
        element: (
          <ProtectedRoute allowedRoles={['employee']}>
            <MySchedulePage />
          </ProtectedRoute>
        ),
      },

      // Manager - clients
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

      // Manager - employees
      {
        path: 'employees',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <EmployeesManagementPage />
          </ProtectedRoute>
        ),
      },

      // Manager - appointments
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

      // Services by role
      {
        path: 'services',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <ServicesRoutePage />
          </ProtectedRoute>
        ),
      },

      // Manager only
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
      {
        path: 'statistics',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <StatisticsPage />
          </ProtectedRoute>
        ),
      },
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
      {
        path: 'notifications',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },

      // Settings
      {
        path: 'settings',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },

      // Client only
      {
        path: 'book',
        element: (
          <ProtectedRoute allowedRoles={['client']}>
            <BookAppointmentPage />
          </ProtectedRoute>
        ),
      },

              // CLIENT profile (RODO)
      {
        path: 'my-client-profile',
        element: (
          <ProtectedRoute allowedRoles={['client']}>
            <ClientMyProfilePage />
          </ProtectedRoute>
        ),
      },

    ],
  },

  { path: '/404', element: <h1>404 Strona nie znaleziona</h1> },
]);

export const AppRouter: React.FC = (): ReactElement => {
  return <RouterProvider router={router} />;
};

export default AppRouter;
