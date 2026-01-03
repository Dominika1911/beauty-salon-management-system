import React, { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { LinearProgress } from '@mui/material';

import Layout from '@/components/Layout/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';

function withSuspense(node: React.ReactNode): React.ReactNode {
    return <Suspense fallback={<LinearProgress />}>{node}</Suspense>;
}

const HomePage = React.lazy(() => import('@/pages/HomePage'));
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const AccessDeniedPage = React.lazy(() => import('@/pages/AccessDeniedPage'));
const NotFoundPage = React.lazy(() => import('@/pages/NotFoundPage'));

const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const AccountPage = React.lazy(() => import('@/pages/AccountPage'));

const ServicesPage = React.lazy(() => import('@/pages/Admin/Services/ServicesPage'));
const EmployeesPage = React.lazy(() => import('@/pages/Admin/Employees/EmployeesPage'));
const EmployeesSchedulePage = React.lazy(() => import('@/pages/Admin/EmployeesSchedulePage'));
const ClientsPage = React.lazy(() => import('@/pages/Admin/Clients/ClientsPage'));
const AdminAppointmentsPage = React.lazy(() => import('@/pages/Admin/Appointments/AppointmentsPage'));
const StatisticsPage = React.lazy(() => import('@/pages/Admin/Statistics/StatisticsPage'));
const ReportsPage = React.lazy(() => import('@/pages/Admin/ReportsPage'));
const SettingsPage = React.lazy(() => import('@/pages/Admin/SettingsPage'));
const LogsPage = React.lazy(() => import('@/pages/Admin/LogsPage'));
const AdminTimeOffPage = React.lazy(() => import('@/pages/Admin/AdminTimeOffPage'));
const EmployeeAppointmentsPage = React.lazy(
    () => import('@/pages/Employee/Appointments/AppointmentsPage'),
);
const EmployeeCalendarPage = React.lazy(() => import('@/pages/Employee/Calendar/CalendarPage'));
const EmployeeSchedulePage = React.lazy(() => import('@/pages/Employee/SchedulePage'));
const EmployeeTimeOffPage = React.lazy(
    () => import('@/pages/Employee/EmployeeTimeOff/EmployeeTimeOffPage'),
);

const ClientAppointmentsPage = React.lazy(() => import('@/pages/Client/Appointments/AppointmentsPage'));
const BookingPage = React.lazy(() => import('@/pages/Client/Booking/BookingPage'));

export const router = createBrowserRouter([
    {
        element: <Layout />,
        children: [

            { path: '/', element: withSuspense(<HomePage />) },
            { path: '/login', element: withSuspense(<LoginPage />) },
            {
                path: '/dashboard',
                element: (
                    <ProtectedRoute>
                        {withSuspense(<DashboardPage />)}
                    </ProtectedRoute>
                ),
            },

            {
                path: '/account',
                element: (
                    <ProtectedRoute>
                        {withSuspense(<AccountPage />)}
                    </ProtectedRoute>
                ),
            },

            {
                path: '/admin/services',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<ServicesPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/employees',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<EmployeesPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/employees-schedule',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<EmployeesSchedulePage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/clients',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<ClientsPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/appointments',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<AdminAppointmentsPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/statistics',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<StatisticsPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/reports',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<ReportsPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/settings',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<SettingsPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/logs',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<LogsPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/time-offs',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        {withSuspense(<AdminTimeOffPage />)}
                    </ProtectedRoute>
                ),
            },

            {
                path: '/employee/calendar',
                element: (
                    <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                        {withSuspense(<EmployeeCalendarPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/employee/appointments',
                element: (
                    <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                        {withSuspense(<EmployeeAppointmentsPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/employee/schedule',
                element: (
                    <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                        {withSuspense(<EmployeeSchedulePage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/employee/time-offs',
                element: (
                    <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                        {withSuspense(<EmployeeTimeOffPage />)}
                    </ProtectedRoute>
                ),
            },

            {
                path: '/client/booking',
                element: (
                    <ProtectedRoute allowedRoles={['CLIENT']}>
                        {withSuspense(<BookingPage />)}
                    </ProtectedRoute>
                ),
            },
            {
                path: '/client/appointments',
                element: (
                    <ProtectedRoute allowedRoles={['CLIENT']}>
                        {withSuspense(<ClientAppointmentsPage />)}
                    </ProtectedRoute>
                ),
            },

            { path: '/access-denied', element: withSuspense(<AccessDeniedPage />) },
            { path: '*', element: withSuspense(<NotFoundPage />) },
        ],
    },
]);
