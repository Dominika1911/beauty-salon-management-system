// src/types/index.ts

// ============================================================================
// UŻYTKOWNIK / ROLE
// ============================================================================

export type UserRole = "ADMIN" | "EMPLOYEE" | "CLIENT";

/**
 * Zgodny z backendem:
 * - /api/users/me/ -> UserDetailSerializer (pełny obiekt z employee_profile/client_profile, updated_at)
 * - /api/auth/login/ -> zwraca user: UserDetailSerializer
 * - /api/auth/status/ -> zwraca user: UserDetailSerializer | null
 */
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
  full_name: string; // ✅ EmployeeSerializer zwraca full_name
  phone: string;
  skills: Service[];

  // write-only fields (używane przy create/update)
  skill_ids?: number[];
  email?: string;
  password?: string;

  is_active: boolean;
  hired_at: string;
  created_at: string;
  updated_at: string;

  // annotate z EmployeeViewSet
  appointments_count: number;
  completed_appointments_count: number;
  revenue_completed_total: string; // DRF Decimal -> string
}

// ============================================================================
// KLIENCI
// ============================================================================

export interface Client {
  id: number;
  user_id: number | null;

  // ✅ serializer zwraca te pola zawsze (mogą być null)
  user_username: string | null;
  user_email: string | null;

  client_number: string;
  first_name: string;
  last_name: string;

  email: string | null;
  phone: string;

  internal_notes: string | null;

  // write-only
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
  | "CANCELLED";

/**
 * Jedno źródło prawdy dla flag statusów wizyt
 * (do selectów, filtrów, mapowań)
 */
export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

/**
 * Zgodny z AppointmentSerializer:
 * - pola relacyjne: client, employee, service (id)
 * - pola "display": client_name, employee_name, service_name, service_price, status_display
 * - UI flags: can_confirm, can_cancel, can_complete
 */
export interface Appointment {
  id: number;

  client: number | null;
  client_name: string | null;

  employee: number;
  employee_name: string;

  service: number;
  service_name: string;
  service_price: string; // DRF Decimal -> string

  start: string; // ISO datetime
  end: string; // ISO datetime

  status: AppointmentStatus;
  status_display: string;

  // UI flags (backend jako jedyne źródło prawdy)
  can_confirm: boolean;
  can_cancel: boolean;
  can_complete: boolean;

  internal_notes: string | null;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// REZERWACJA I DOSTĘPNOŚĆ
// ============================================================================

/**
 * Zgodny z BookingCreateSerializer:
 * - service_id, employee_id, start są wymagane
 * - client_id jest opcjonalne (CLIENT ma nadpisywane przez backend,
 *   ADMIN/EMPLOYEE muszą podać, ale to jest walidacja backendu)
 */
export interface BookingCreate {
  service_id: number;
  employee_id: number;
  start: string; // ISO datetime
  client_id?: number;
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

export type DashboardResponse =
  | AdminDashboard
  | EmployeeDashboard
  | ClientDashboard;

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

// ============================================================================
// SYSTEM
// ============================================================================

/**
 * Globalny typ paginacji DRF (PageNumberPagination)
 */
export type DRFPaginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

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

  // ✅ serializer zwraca zawsze (nullable), więc nie opcjonalne
  performed_by: number | null;
  performed_by_username: string | null;

  target_user: number | null;
  target_user_username: string | null;

  timestamp: string;
}

// ============================================================================
// AUTH
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

// ============================================================================
// TIME OFF
// ============================================================================

export type TimeOffStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * Jedno źródło prawdy dla flag urlopów
 */
export const TIME_OFF_STATUSES: TimeOffStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
];

/**
 * Zgodny z TimeOffSerializer:
 * - employee_name
 * - status_display
 * - UI flags: can_cancel, can_approve, can_reject
 */
export interface TimeOff {
  id: number;

  employee: number;
  employee_name: string;

  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  reason: string;

  status: TimeOffStatus;
  status_display: string;

  // UI flags (backend jako jedyne źródło prawdy)
  can_cancel: boolean;
  can_approve: boolean;
  can_reject: boolean;

  requested_by: number | null;

  decided_by: number | null;
  decided_at: string | null;

  created_at: string;
}
