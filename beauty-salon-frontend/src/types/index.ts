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
  start: string;
  end: string;
  employee: number;
  employee_name: string;
}

// Dashboard - Admin
export interface AdminDashboard {
  today_appointments: Appointment[];
  pending_appointments_count: number;
  monthly_revenue: string;
  active_employees: number;
  active_clients: number;
  active_services: number;
}

// Dashboard - Employee
export interface EmployeeDashboard {
  today_schedule: Appointment[];
  upcoming_appointments: Appointment[];
  monthly_completed: number;
}

// Dashboard - Client
export interface ClientDashboard {
  upcoming_appointments: Appointment[];
  completed_count: number;
  last_visit: Appointment | null;
}

// Raporty - Przychody
export interface RevenueReport {
  summary: {
    total_revenue: string;
    appointment_count: number;
    average_per_appointment: string;
  };
  data: Array<{
    date: string;
    revenue: string;
    count: number;
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
