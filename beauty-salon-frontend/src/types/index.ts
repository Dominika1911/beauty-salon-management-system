/* cSpell:disable */
// src/types/index.ts

// ============================================================================
// UŻYTKOWNIK / ROLE
// ============================================================================

export type UserRole = "ADMIN" | "EMPLOYEE" | "CLIENT";

export interface User {
  id: number;
  username: string;
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
  price: string; // DRF Decimal -> string
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
  full_name: string;
  phone: string;
  skills: Service[];
  skill_ids?: number[];
  email?: string;
  password?: string;
  is_active: boolean;
  hired_at: string;
  created_at: string;
  updated_at: string;
  appointments_count: number;
  completed_appointments_count: number;
  revenue_completed_total: string;
}

// ============================================================================
// KLIENCI
// ============================================================================

export interface Client {
  id: number;
  user_id: number;
  user_username: string;
  user_email: string;
  client_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  internal_notes: string;
  password?: string;
  is_active: boolean;
  appointments_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// WIZYTY
// ============================================================================

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];


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
  can_confirm: boolean;
  can_cancel: boolean;
  can_complete: boolean;
  can_no_show: boolean;
  internal_notes: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// REZERWACJA I DOSTĘPNOŚĆ
// ============================================================================

export interface BookingCreate {
  service_id: number;
  employee_id: number;
  start: string;
  client_id?: number;
}

export interface AvailableSlot {
  start: string;
  end: string;
}

// ============================================================================
// DASHBOARDY
// ============================================================================

export interface AdminDashboard {
  role: "ADMIN";
  today: { date: string; appointments_count: number; appointments: Appointment[] };
  pending_appointments: number;
  current_month: { revenue: number; completed_appointments: number };
  system: { active_employees: number; active_clients: number; active_services: number };
}

export interface EmployeeDashboard {
  role: "EMPLOYEE";
  employee_number: string;
  full_name: string;
  today: { date: string; appointments: Appointment[] };
  upcoming: { count: number; appointments: Appointment[] };
  this_month: { completed_appointments: number };
}

export interface ClientDashboard {
  role: "CLIENT";
  client_number: string;
  full_name: string;
  upcoming_appointments: { count: number; appointments: Appointment[] };
  history: { total_completed: number; recent: Appointment[] };
}

export type DashboardResponse = AdminDashboard | EmployeeDashboard | ClientDashboard;

// ============================================================================
// RAPORTY
// ============================================================================

export type ReportType = "revenue" | "employees" | "clients" | "today";
export type RevenueGroupBy = "day" | "month";

export interface RevenueReport {
  range: { from: string; to: string };
  group_by: RevenueGroupBy;
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

export interface AvailableReport {
  type: ReportType;
  description: string;
}

// ============================================================================
// SYSTEM I AUTORYZACJA
// ============================================================================

export type DRFPaginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export interface LoginRequest { username: string; password: string; }
export interface LoginResponse { detail: string; user: User; }
export interface AuthStatusResponse { isAuthenticated: boolean; user: User | null; }

// ============================================================================
// TIME OFF
// ============================================================================

export type TimeOffStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export const TIME_OFF_STATUSES: TimeOffStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

export interface TimeOff {
  id: number;
  employee: number;
  employee_name: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: TimeOffStatus;
  status_display: string;
  can_cancel: boolean;
  can_approve: boolean;
  can_reject: boolean;
  requested_by: number | null;
  decided_by: number | null;
  decided_at: string | null;
  created_at: string;
}

export interface SystemSettings {
  id: number;
  salon_name: string;
  slot_minutes: number;
  buffer_minutes: number;
  opening_hours: Record<string, Array<{ start: string; end: string }>>;
  updated_at: string;
  updated_by: number | null;
  updated_by_username: string | null;
}

export interface SystemLog {
  id: number;
  action: string;
  action_display: string;
  performed_by: number | null;
  performed_by_username: string | null;
  target_user: number | null;
  target_user_username: string | null;
  timestamp: string;
}
