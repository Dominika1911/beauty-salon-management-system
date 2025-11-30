export interface User {
  id: number;
  email: string;
  role: 'manager' | 'employee' | 'client';
  role_display: string;
  is_active: boolean;
  is_staff: boolean;
  employee_id?: number;
  client_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  isAuthenticated: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isClient: boolean;
}


export interface Appointment {
  id: number;
  client: number;
  client_name: string;
  employee: number;
  employee_name: string;
  service: number;
  service_name: string;
  start: string;
  end: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  status_display: string;
  booking_channel: string;
  client_notes?: string;
  internal_notes?: string;
  timespan?: string;
  created_at: string;
  updated_at: string;
}
export type DashboardAppointment = Appointment;


export interface AppointmentCreateData {
  client: string;
  employee: string;
  service: string;
  start: string;
  end?: string;
  booking_channel?: string;
  client_notes?: string;
  internal_notes?: string;
}

export interface AppointmentStatusUpdateData {
  status: string;
  cancellation_reason?: string;
}

export interface Service {
  id: number;
  name: string;
  category: string;
  description: string;
  price: string;
  duration: string;
  image_url: string;
  is_published: boolean;
  promotion?: object;
  reservations_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceCreateData {
  name: string;
  category: string;
  description?: string;
  price: string;
  duration: string;
  image_url?: string;
  is_published?: boolean;
  promotion?: object;
}

export interface Client {
  id: number;
  number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  visits_count: number;
  total_spent_amount: string;
  marketing_consent: boolean;
  preferred_contact: string;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientCreateData {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  marketing_consent?: boolean;
  preferred_contact?: string;
  internal_notes?: string;
}

export interface Employee {
  id: number;
  number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  hired_at: string;
  is_active: boolean;
  appointments_count: number;
  average_rating: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCreateData {
  user: number;
  first_name: string;
  last_name: string;
  phone?: string;
  hired_at?: string;
  is_active?: boolean;
  skill_ids?: number[];
}

export interface DashboardTodayData {
  date: string;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  new_clients: number;
  revenue: string;
}

export interface DashboardData {
  role: 'client' | 'employee' | 'manager';
  client?: Client;
  employee?: Employee;
  today?: DashboardTodayData;
  latest_stats_snapshot?: unknown;
  upcoming_appointments?: Appointment[];
  today_appointments?: Appointment[];
  last_visits?: Appointment[];
  today_appointments_count?: number;
  upcoming_appointments_count?: number;
  total_spent?: string;
  pending_time_off_requests?: unknown[];
}

export interface ClientDashboardData {
  total_spent?: string;
  client?: Client;
  upcoming_appointments?: DashboardAppointment[];
  last_visits?: DashboardAppointment[];
}

export interface EmployeeDashboardData {
  today_appointments_count?: number;
  upcoming_appointments_count?: number;
  today_appointments?: DashboardAppointment[];
  upcoming_appointments?: DashboardAppointment[];
}

export interface ManagerDashboardData {
  today?: DashboardTodayData;
  upcoming_appointments?: DashboardAppointment[];
}