import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import Layout from '../components/Layout/Layout';

// Pages - Public
import LoginPage from '../pages/LoginPage';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import AccessDeniedPage from '../pages/AccessDeniedPage';

// Pages - Admin
import AdminDashboardPage from '../pages/Admin/DashboardPage';
import AdminAppointmentsPage from '../pages/Admin/AppointmentsPage';
import AdminEmployeesPage from '../pages/Admin/EmployeesPage';
import AdminEmployeeSchedulePage from '../pages/Admin/EmployeesSchedulePage.tsx';
import AdminClientsPage from '../pages/Admin/ClientsPage';
import AdminServicesPage from '../pages/Admin/ServicesPage';
import AdminReportsPage from '../pages/Admin/ReportsPage';
import AdminSettingsPage from '../pages/Admin/SettingsPage';

// Pages - Employee
import EmployeeDashboardPage from '../pages/Employee/DashboardPage';
import EmployeeAppointmentsPage from '../pages/Employee/AppointmentsPage';
import EmployeeSchedulePage from '../pages/Employee/SchedulePage';

// Pages - Client
import ClientDashboardPage from '../pages/Client/DashboardPage';
import ClientBookingPage from '../pages/Client/BookingPage';
import ClientAppointmentsPage from '../pages/Client/AppointmentsPage';

const router = createBrowserRouter([
  // Public routes
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/access-denied',
    element: <AccessDeniedPage />,
  },

  // Admin routes
  {
    path: '/admin',
    element: (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <AdminDashboardPage /> },
      { path: 'appointments', element: <AdminAppointmentsPage /> },
      { path: 'employees', element: <AdminEmployeesPage /> },
      { path: 'employees/:id/schedule', element: <AdminEmployeeSchedulePage /> },
      { path: 'clients', element: <AdminClientsPage /> },
      { path: 'services', element: <AdminServicesPage /> },
      { path: 'reports', element: <AdminReportsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
    ],
  },

  // Employee routes
  {
    path: '/employee',
    element: (
      <ProtectedRoute allowedRoles={['EMPLOYEE']}>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/employee/dashboard" replace /> },
      { path: 'dashboard', element: <EmployeeDashboardPage /> },
      { path: 'appointments', element: <EmployeeAppointmentsPage /> },
      { path: 'schedule', element: <EmployeeSchedulePage /> },
    ],
  },

  // Client routes
  {
    path: '/client',
    element: (
      <ProtectedRoute allowedRoles={['CLIENT']}>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/client/dashboard" replace /> },
      { path: 'dashboard', element: <ClientDashboardPage /> },
      { path: 'booking', element: <ClientBookingPage /> },
      { path: 'appointments', element: <ClientAppointmentsPage /> },
    ],
  },

  // 404
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default router;
