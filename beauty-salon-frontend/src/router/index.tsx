import React from "react";
import { Routes, Route } from "react-router-dom";

import Layout from "../components/Layout/Layout";
import ProtectedRoute from "../components/ProtectedRoute";

import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import AccessDeniedPage from "../pages/AccessDeniedPage";
import NotFoundPage from "../pages/NotFoundPage";

// ADMIN pages
import AdminDashboardPage from "../pages/Admin/DashboardPage";
import ServicesPage from "../pages/Admin/ServicesPage";
import EmployeesPage from "../pages/Admin/EmployeesPage";
import ClientsPage from "../pages/Admin/ClientsPage";
import AdminAppointmentsPage from "../pages/Admin/AppointmentsPage";
import SettingsPage from "../pages/Admin/SettingsPage";
import EmployeesSchedulePage from "../pages/Admin/EmployeesSchedulePage";
import ReportsPage from "../pages/Admin/ReportsPage";
import LogsPage from "../pages/Admin/LogsPage";
import AdminTimeOffPage from "../pages/Admin/AdminTimeOffPage";

// EMPLOYEE pages
import EmployeeDashboardPage from "../pages/Employee/DashboardPage";
import EmployeeAppointmentsPage from "../pages/Employee/AppointmentsPage";
import EmployeeSchedulePage from "../pages/Employee/SchedulePage";
import EmployeeCalendarPage from "../pages/Employee/CalendarPage";
import EmployeeTimeOffPage from "../pages/Employee/EmployeeTimeOffPage";

// CLIENT pages
import ClientDashboardPage from "../pages/Client/DashboardPage";
import ClientAppointmentsPage from "../pages/Client/AppointmentsPage";
import BookingPage from "../pages/Client/BookingPage";

export default function Router() {
  return (
    <Routes>
      {/* Publiczne trasy */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      {/* Trasy chronione z Layoutem (Navbar + Sidebar) */}
      <Route element={<Layout />}>
        {/* =========================================================
            ADMIN ROUTES
        ========================================================= */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/appointments"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminAppointmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/services"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <ServicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees-schedule"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <EmployeesSchedulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clients"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <LogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/time-offs"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminTimeOffPage />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            EMPLOYEE ROUTES
        ========================================================= */}
        <Route
          path="/employee/dashboard"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <EmployeeDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/appointments"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <EmployeeAppointmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/calendar"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <EmployeeCalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/schedule"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <EmployeeSchedulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/time-offs"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <EmployeeTimeOffPage />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            CLIENT ROUTES
        ========================================================= */}
        <Route
          path="/client/dashboard"
          element={
            <ProtectedRoute allowedRoles={["CLIENT"]}>
              <ClientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/appointments"
          element={
            <ProtectedRoute allowedRoles={["CLIENT"]}>
              <ClientAppointmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/booking"
          element={
            <ProtectedRoute allowedRoles={["CLIENT"]}>
              <BookingPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 - Not Found */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}