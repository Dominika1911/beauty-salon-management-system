// Typy użytkownika i ról
export type UserRole = 'ADMIN' | 'EMPLOYEE' | 'CLIENT';

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  role_display: string;
  is_active: boolean;
  employee_profile?: {
    id: number;
    employee_number: string;
    full_name: string;
  };
  client_profile?: {
    id: number;
    client_number: string;
    full_name: string;
  };
  created_at: string;
  updated_at: string;
}

// Usługi
export interface Service {
  id: number;
  name: string;
  category: string;
  description: string;
  price: string;
  duration_minutes: number;
  duration_display: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Pracownicy
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
  email?: string;  // Tylko przy tworzeniu
  password?: string;  // Tylko przy tworzeniu
  is_active: boolean;
  hired_at: string;
  created_at: string;
  updated_at: string;
}

// Klienci
export interface Client {
  id: number;
  user: number | null;
  user_username?: string;
  client_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  internal_notes: string;
  password?: string;  // Tylko przy tworzeniu
  is_active: boolean;
  appointments_count: number;
  created_at: string;
  updated_at: string;
}

// Statusy wizyt
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

// Wizyty
export interface Appointment {
  id: number;
  client: number;
  client_name: string | null;
  employee: number;
  employee_name: string;
  service: number;
  service_name: string;
  service_price: string;  // Cena usługi
  service_duration: number;  // Czas trwania w minutach
  start: string;
  end: string;
  status: AppointmentStatus;
  status_display: string;
  internal_notes: string;
  created_at: string;
  updated_at: string;
}

// Rezerwacja wizyty
export interface BookingCreate {
  client_id?: number;
  employee_id: number;
  service_id: number;
  start: string;
}

// Dostępne sloty
export interface AvailableSlot {
  start: string;  // ISO timestamp: "2025-12-25T09:00:00+01:00"
  end: string;    // ISO timestamp: "2025-12-25T09:45:00+01:00"
}

// ============================================================================
// DASHBOARDS - POPRAWIONE ZGODNIE Z BACKENDEM
// ============================================================================

// Dashboard - Admin
export interface AdminDashboard {
  role: 'ADMIN';
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

// Dashboard - Employee
export interface EmployeeDashboard {
  role: 'EMPLOYEE';
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

// Dashboard - Client
export interface ClientDashboard {
  role: 'CLIENT';
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

// Union type dla wszystkich dashboardów
export type DashboardResponse = AdminDashboard | EmployeeDashboard | ClientDashboard;

// ============================================================================
// RAPORTY
// ============================================================================

// Raporty - Przychody
export interface RevenueReport {
  range: {
    from: string;
    to: string;
  };
  group_by: 'day' | 'month';
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

// Raporty - Wydajność pracownika
export interface EmployeePerformance {
  employee: number;
  employee_name: string;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  completion_rate: number;
  total_revenue: string;
  top_services: Array<{
    service_name: string;
    count: number;
  }>;
}

// Raporty - Popularne usługi
export interface PopularService {
  service: Service;
  bookings_count: number;
  completed_count: number;
  total_revenue: string;
}

// Ustawienia systemu
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

// Auth - Login Request
export interface LoginRequest {
  username: string;
  password: string;
}

// Auth - Login Response
export interface LoginResponse {
  detail: string;
  user: User;
}

// Auth - Status Response
export interface AuthStatusResponse {
  isAuthenticated: boolean;
  user: User | null;
}

// Errors
export interface ApiError {
  detail?: string;
  [key: string]: any;
}

// Pagination
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}