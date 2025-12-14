// ============================================================================
// CORE & PAGINATION
// ============================================================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ============================================================================
// USER & AUTH
// ============================================================================

export type UserRole = 'manager' | 'employee' | 'client';

export interface User {
  id: number;
  email: string;
  // Uwaga: backendowy UserDetailSerializer może nie zwracać imienia/nazwiska
  // (zależnie od modelu User). Zostawiamy pola opcjonalne, żeby nie psuć typów.
  first_name?: string;
  last_name?: string;
  role: UserRole;
  role_display?: string; // Display name dla roli
  is_active: boolean;
  is_staff: boolean;
  // Backend (UserDetailSerializer) zwraca też powiązania profili
  employee_id?: number | null;
  client_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean; // Alias dla isLoading
  error: string | null;
  isManager: boolean;
  isEmployee: boolean;
  isClient: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser?: () => Promise<void>;
  checkAuthStatus?: () => Promise<void>;
}

// ============================================================================
// CLIENT
// ============================================================================

export interface Client {
  id: number;
  user: number | null;
  number: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  visits_count: number;
  total_spent_amount: string;
  marketing_consent: boolean;
  preferred_contact: 'email' | 'sms' | 'phone' | 'none';
  internal_notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ClientCreateUpdateData {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  marketing_consent?: boolean;
  preferred_contact?: 'email' | 'sms' | 'phone' | 'none';
  internal_notes?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export interface Service {
  id: number;
  name: string;
  description: string;
  price: string;
  duration: string;
  category: string;
  is_published: boolean;
  promotion: Record<string, any> | string; // Może być obiekt lub JSON string
  image_url: string;
  reservations_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ServiceCreateUpdateData {
  name: string;
  description?: string;
  price: number;
  duration: string;
  category?: string;
  is_published?: boolean;
  promotion?: Record<string, any> | string; // Może być obiekt lub JSON string
  image_url?: string;
}

// ============================================================================
// EMPLOYEE
// ============================================================================

export interface Employee {
  id: number;
  user: number;
  number: string;
  first_name: string;
  last_name: string;
  phone: string;
  hired_at: string;
  is_active: boolean;
  skills: Service[];
  appointments_count: number;
  average_rating: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  user_email?: string;
  skill_ids?: number[];
  schedule?: Schedule | null;
  time_offs?: TimeOff[];
}

export interface EmployeeCreateData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  number?: string;
  is_active?: boolean;
  skill_ids: number[];
  hired_at?: string;
}

// ============================================================================
// APPOINTMENT
// ============================================================================

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * To zwraca backend w listach:
 * - GET /appointments/
 * - GET /appointments/my_appointments/
 * - GET /appointments/today/
 * - GET /appointments/upcoming/
 */
export interface AppointmentListItem {
  id: number;
  client: number | null;
  client_name: string | null;
  employee: number;
  employee_name: string;
  service: number;
  service_name: string;
  status: AppointmentStatus;
  status_display?: string;
  start: string;
  end: string;

  // extra z list serializer
  timespan?: string;
  booking_channel?: string;
  client_notes?: string;
  internal_notes?: string;
  reminder_sent?: boolean;
  reminder_sent_at?: string | null;
}

/**
 * To zwraca backend w detalu:
 * - GET /appointments/{id}/
 */
export interface AppointmentDetail {
  id: number;
  client: Client | null;
  employee: Pick<Employee, 'id' | 'number' | 'first_name' | 'last_name'> & {
    user_email?: string;
  };
  service: Service;

  status: AppointmentStatus;
  status_display?: string;

  start: string;
  end: string;
  timespan?: string;

  booking_channel: string;
  client_notes: string;
  internal_notes: string;

  cancelled_by: number | null;
  cancelled_by_email?: string | null;
  cancelled_at: string | null;
  cancellation_reason: string;

  reminder_sent: boolean;
  reminder_sent_at: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * Create/Update payload:
 * Backend przyjmuje slugowe pola biznesowe:
 * - client: Client.number (np. "CLI-0001")
 * - employee: Employee.number (np. "EMP-0001")
 * - service: Service.name (np. "Manicure")
 * oraz start/end (end może być pominięte -> backend policzy z duration)
 */
export interface AppointmentCreateData {
  client?: string | null;      // Client.number
  employee: string;            // Employee.number
  service: string;             // Service.name
  start: string;
  end?: string | null;
  booking_channel?: string;
  client_notes?: string;
  internal_notes?: string;
}

/**
 * Zmiana statusu:
 * - POST /appointments/{id}/change_status/
 */
export interface AppointmentStatusUpdateData {
  status: AppointmentStatus;
  cancellation_reason?: string;
}

/**
 * Jeśli chcesz mieć dalej "Appointment" jako jeden typ, to najbezpieczniej:
 * - listy -> AppointmentListItem
 * - detail -> AppointmentDetail
 *
 * Ale żeby nie psuć istniejących importów, możesz używać union:
 */
export type Appointment = AppointmentListItem | AppointmentDetail;


// ============================================================================
// DASHBOARD
// ============================================================================

export interface DashboardAppointment {
  id: number;
  client_name: string;
  service_name: string;
  employee_name?: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  status_display?: string;
}

export interface DashboardData {
  role: UserRole;
  user: User;
  stats?: Record<string, any>;
  upcoming_appointments?: DashboardAppointment[];
  recent_appointments?: DashboardAppointment[];
}

export interface ClientDashboardData extends DashboardData {
  role: 'client';
  stats: {
    total_appointments: number;
    upcoming_appointments: number;
    completed_appointments: number;
    total_spent?: string;
  };
  total_spent?: string;
  client?: {
    visits_count: number;
  };
  last_visits?: DashboardAppointment[];
}

export interface EmployeeDashboardData extends DashboardData {
  role: 'employee';
  stats: {
    today_appointments?: number;
    today_appointments_count?: number; // Alias
    week_appointments?: number;
    upcoming_appointments_count?: number;
    completed_this_month?: number;
    average_rating?: string;
  };
  today_appointments?: DashboardAppointment[];
}

export interface ManagerDashboardData extends DashboardData {
  role: 'manager';
  stats: {
    total_appointments: number;
    pending_appointments: number;
    completed_today: number;
    revenue_today: string;
    revenue_this_month: string;
    total_clients: number;
    total_employees: number;
    active_employees: number;
  };
  today?: {
    total_appointments: number;
  };
}

// ============================================================================
// TIME OFF
// ============================================================================

export type TimeOffStatus = 'pending' | 'approved' | 'rejected';
export type TimeOffType = 'vacation' | 'sick_leave' | 'other';

export interface TimeOff {
  id: number;
  employee: number;     // ID pracownika
  date_from: string;    // YYYY-MM-DD
  date_to: string;      // YYYY-MM-DD
  status: TimeOffStatus;
  type: TimeOffType;
  reason: string;

  approved_by?: number | null;
  approved_at?: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface TimeOffCreateUpdateData {
  employee: number;
  date_from: string;
  date_to: string;
  type?: TimeOffType;
  reason?: string;
  status?: TimeOffStatus;
}

// ============================================================================
// SCHEDULE
// ============================================================================

export type Weekday =
  | 'Poniedziałek'
  | 'Wtorek'
  | 'Środa'
  | 'Czwartek'
  | 'Piątek'
  | 'Sobota'
  | 'Niedziela';

export interface ScheduleEntry {
  id?: number;
  weekday: Weekday;
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
}

export interface Schedule {
  status: 'active' | 'inactive';
  availability_periods: ScheduleEntry[];
  breaks: any[];
}
