import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/Layout/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';

// =========================
// PUBLIC
// =========================
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import AccessDeniedPage from '@/pages/AccessDeniedPage';
import NotFoundPage from '@/pages/NotFoundPage';

// =========================
// SHARED
// =========================
import DashboardPage from '@/pages/DashboardPage';
import AccountPage from '@/pages/AccountPage';

// =========================
// ADMIN
// =========================
import ServicesPage from '@/pages/Admin/Services/ServicesPage';
import EmployeesPage from '@/pages/Admin/Employees/EmployeesPage';
import EmployeesSchedulePage from '@/pages/Admin/EmployeesSchedulePage';
import ClientsPage from '@/pages/Admin/Clients/ClientsPage.tsx';
import AdminAppointmentsPage from '@/pages/Admin/Appointments/AppointmentsPage.tsx';
import StatisticsPage from '@/pages/Admin/Statistics/StatisticsPage.tsx';
import ReportsPage from '@/pages/Admin/ReportsPage';
import SettingsPage from '@/pages/Admin/SettingsPage';
import LogsPage from '@/pages/Admin/LogsPage';
import AdminTimeOffPage from '@/pages/Admin/AdminTimeOffPage';

// =========================
// EMPLOYEE
// =========================
import EmployeeAppointmentsPage from '@/pages/Employee/Appointments/AppointmentsPage.tsx';
import EmployeeCalendarPage from '@/pages/Employee/Calendar/CalendarPage';
import EmployeeSchedulePage from '@/pages/Employee/SchedulePage';
import EmployeeTimeOffPage from "@/pages/Employee/EmployeeTimeOff/EmployeeTimeOffPage";


// =========================
// CLIENT
// =========================
import ClientAppointmentsPage from '@/pages/Client/Appointments/AppointmentsPage';
import BookingPage from '@/pages/Client/Booking/BookingPage.tsx';

export const router = createBrowserRouter([
    {
        element: <Layout />,
        children: [
            // ======================================================
            // PUBLIC
            // ======================================================
            { path: '/', element: <HomePage /> },
            { path: '/login', element: <LoginPage /> },

            // ======================================================
            // DASHBOARD – JEDEN DLA WSZYSTKICH RÓL
            // ======================================================
            {
                path: '/dashboard',
                element: (
                    <ProtectedRoute>
                        <DashboardPage />
                    </ProtectedRoute>
                ),
            },

            // ======================================================
            // ACCOUNT / PROFILE – ZMIANA HASŁA (ALL ROLES)
            // ======================================================
            {
                path: '/account',
                element: (
                    <ProtectedRoute>
                        <AccountPage />
                    </ProtectedRoute>
                ),
            },

            // ======================================================
            // ADMIN
            // ======================================================
            {
                path: '/admin/services',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <ServicesPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/employees',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <EmployeesPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/employees-schedule',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <EmployeesSchedulePage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/clients',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <ClientsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/appointments',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <AdminAppointmentsPage />
                    </ProtectedRoute>
                ),
            },
            {
                // ✅ DODANE - STATYSTYKI
                path: '/admin/statistics',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <StatisticsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/reports',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <ReportsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/settings',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <SettingsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/logs',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <LogsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/time-offs',
                element: (
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <AdminTimeOffPage />
                    </ProtectedRoute>
                ),
            },

            // ======================================================
            // EMPLOYEE
            // ======================================================
            {
                path: '/employee/calendar',
                element: (
                    <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                        <EmployeeCalendarPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/employee/appointments',
                element: (
                    <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                        <EmployeeAppointmentsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/employee/schedule',
                element: (
                    <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                        <EmployeeSchedulePage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/employee/time-offs',
                element: (
                    <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                        <EmployeeTimeOffPage />
                    </ProtectedRoute>
                ),
            },

            // ======================================================
            // CLIENT
            // ======================================================
            {
                path: '/client/booking',
                element: (
                    <ProtectedRoute allowedRoles={['CLIENT']}>
                        <BookingPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/client/appointments',
                element: (
                    <ProtectedRoute allowedRoles={['CLIENT']}>
                        <ClientAppointmentsPage />
                    </ProtectedRoute>
                ),
            },

            // ======================================================
            // ERRORS
            // ======================================================
            { path: '/access-denied', element: <AccessDeniedPage /> },
            { path: '*', element: <NotFoundPage /> },
        ],
    },
]);
