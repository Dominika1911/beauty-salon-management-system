import { createBrowserRouter } from "react-router-dom";
import Layout from "@/components/Layout/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

// Public
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import AccessDeniedPage from "@/pages/AccessDeniedPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Dashboard (jedna strona – rozróżnia role po API /dashboard/)
import DashboardPage from "@/pages/DashboardPage";

// ADMIN
import ServicesPage from "@/pages/Admin/ServicesPage";
import EmployeesPage from "@/pages/Admin/EmployeesPage";
import EmployeesSchedulePage from "@/pages/Admin/EmployeesSchedulePage";
import ClientsPage from "@/pages/Admin/ClientsPage";
import AdminAppointmentsPage from "@/pages/Admin/AppointmentsPage";
import ReportsPage from "@/pages/Admin/ReportsPage";
import SettingsPage from "@/pages/Admin/SettingsPage";
import LogsPage from "@/pages/Admin/LogsPage";
import AdminTimeOffPage from "@/pages/Admin/AdminTimeOffPage";

// EMPLOYEE
import EmployeeAppointmentsPage from "@/pages/Employee/AppointmentsPage";
import EmployeeCalendarPage from "@/pages/Employee/CalendarPage";
import EmployeeSchedulePage from "@/pages/Employee/SchedulePage";
import EmployeeTimeOffPage from "@/pages/Employee/EmployeeTimeOffPage";

// CLIENT
import ClientAppointmentsPage from "@/pages/Client/AppointmentsPage";
import BookingPage from "@/pages/Client/BookingPage";

export const router = createBrowserRouter([
  {
    element: <Layout />, 
    children: [
      // =========================
      // PUBLIC
      // =========================
      { path: "/", element: <HomePage /> },
      { path: "/login", element: <LoginPage /> },

      // =========================
      // UNIWERSALNY DASHBOARD (NAPRAWA 404)
      // =========================
      // Ta ścieżka musi istnieć, bo LoginPage robi navigate("/dashboard")
      { 
        path: "/dashboard", 
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ) 
      },

      // =========================
      // ADMIN
      // =========================
      {
        path: "/admin/dashboard",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/services",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <ServicesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/employees",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <EmployeesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/employees-schedule",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <EmployeesSchedulePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/clients",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <ClientsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/appointments",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminAppointmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/reports",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/settings",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/logs",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <LogsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/time-offs",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminTimeOffPage />
          </ProtectedRoute>
        ),
      },

      // =========================
      // EMPLOYEE
      // =========================
      {
        path: "/employee/dashboard",
        element: (
          <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/employee/calendar",
        element: (
          <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
            <EmployeeCalendarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/employee/appointments",
        element: (
          <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
            <EmployeeAppointmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/employee/schedule",
        element: (
          <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
            <EmployeeSchedulePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/employee/time-offs",
        element: (
          <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
            <EmployeeTimeOffPage />
          </ProtectedRoute>
        ),
      },

      // =========================
      // CLIENT
      // =========================
      {
        path: "/client/dashboard",
        element: (
          <ProtectedRoute allowedRoles={["CLIENT"]}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/client/booking",
        element: (
          <ProtectedRoute allowedRoles={["CLIENT"]}>
            <BookingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/client/appointments",
        element: (
          <ProtectedRoute allowedRoles={["CLIENT"]}>
            <ClientAppointmentsPage />
          </ProtectedRoute>
        ),
      },

      // =========================
      // ERRORS
      // =========================
      { path: "/access-denied", element: <AccessDeniedPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);