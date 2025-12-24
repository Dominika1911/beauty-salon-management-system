// src/types/index.ts

// ============================================================================
// UŻYTKOWNIK / ROLE
// ============================================================================

export type UserRole = "ADMIN" | "EMPLOYEE" | "CLIENT";

export interface User {
  id: number;
  username: string | null;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  role_display: string;
  is_active: boolean;
  employee_profile: {
    id: number;
    employee_number: string;
    full_name: string;
  } | null;
  client_profile: {
    id: number;
    client_number: string;
    full_name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// USŁUGI
// ============================================================================

export interface Service {
  id: number;
  name: string;
  category: string;
  description: string;
  price: string; // DRF Decimal przesyła jako string
  duration_minutes: number;
  duration_display: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PRACOWNICY
// ============================================================================

export interface Employee {
  id: number;
  user: number;
  user_username: string;
  user_email: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  skills: Service[];
  skill_ids?: number[];
  email?: string;
  password?: string;
  is_active: boolean;
  hired_at: string;
  created_at: string;
  updated_at: string;
  // Pola dodawane przez annotate w EmployeeViewSet
  appointments_count: number;
  completed_appointments_count: number;
  revenue_completed_total: string;
}

// ============================================================================
// KLIENCI
// ============================================================================

export interface Client {
  id: number;
  user: number | null;
  user_username?: string;
  user_email?: string;

  client_number: string;
  first_name: string;
  last_name: string;

  email: string;
  phone: string;

  internal_notes: string;
  password?: string;

  is_active: boolean;

  // Poprawione: Backend zawsze to zwraca dzięki annotate w ClientViewSet
  // Brak znaku zapytania naprawia błąd TS18048 w Twoim kodzie React
  appointments_count: number;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// WIZYTY
// ============================================================================

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export interface Appointment {
  id: number;
  client: number | null;
  client_name: string | null;
  employee: number;
  employee_name: string;
  service: number;
  service_name: string;
  service_price: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  status_display: string;
  internal_notes: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// REZERWACJA I DOSTĘPNOŚĆ
// ============================================================================

export interface BookingCreate {
  client_id?: number;
  employee_id: number;
  service_id: number;
  start: string;
}

export interface AvailableSlot {
  start: string;
  end: string;
}

// ============================================================================
// DASHBOARD
// ============================================================================

export interface AdminDashboard {
  role: "ADMIN";
  today: {
    date: string;
    appointments_count: number;
    appointments: Appointment[];
  };
  pending_appointments: number;
  current_month: {
    revenue: number;
    completed_appointments: number;
  };
  system: {
    active_employees: number;
    active_clients: number;
    active_services: number;
  };
}

export interface EmployeeDashboard {
  role: "EMPLOYEE";
  employee_number: string;
  full_name: string;
  today: {
    date: string;
    appointments: Appointment[];
  };
  upcoming: {
    count: number;
    appointments: Appointment[];
  };
  this_month: {
    completed_appointments: number;
  };
}

export interface ClientDashboard {
  role: "CLIENT";
  client_number: string;
  full_name: string;
  upcoming_appointments: {
    count: number;
    appointments: Appointment[];
  };
  history: {
    total_completed: number;
    recent: Appointment[];
  };
}

export type DashboardResponse = AdminDashboard | EmployeeDashboard | ClientDashboard;

// ============================================================================
// RAPORTY
// ============================================================================

export interface RevenueReport {
  range: { from: string; to: string };
  group_by: "day" | "month";
  summary: {
    total_revenue: number;
    total_appointments: number;
    average_per_appointment: number;
  };
  data: Array<{
    period: string;
    revenue: number;
    appointments_count: number;
  }>;
}

export interface EmployeePerformanceReport {
  employee: {
    id: number;
    employee_number: string;
    full_name: string;
  };
  period: { from: string; to: string };
  statistics: {
    total_appointments: number;
    completed: number;
    cancelled: number;
    completion_rate: number;
    total_revenue: number;
  };
  top_services: Array<{
    service__id: number;
    service__name: string;
    count: number;
  }>;
}

export interface PopularServicesResponse {
  period: { from: string; to: string };
  top_services: Array<{ // Klucz zmieniony na 'top_services' zgodnie z views.py
    service__id: number;
    service__name: string;
    count: number;
  }>;
}

// ============================================================================
// SYSTEM
// ============================================================================

export interface SystemSettings {
  id: number;
  salon_name: string;
  slot_minutes: number;
  buffer_minutes: number;
  opening_hours: {
    [key: string]: Array<{
      start: string;
      end: string;
    }>;
  };
  updated_at: string;
  updated_by: number | null;
  updated_by_username: string | null;
}

export interface SystemLog {
  id: number;
  action: string;
  action_display: string;
  performed_by_username: string | null;
  target_user_username: string | null;
  timestamp: string;
}

// ============================================================================
// AUTH / API
// ============================================================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  detail: string;
  user: User;
}

export interface AuthStatusResponse {
  isAuthenticated: boolean;
  user: User | null;
}

