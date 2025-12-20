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
  first_name?: string;
  last_name?: string;
  role: UserRole;
  role_display?: string;
  is_active: boolean;
  is_staff: boolean;
  employee_id?: number | null;
  client_id?: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// USER MANAGEMENT (dla managera) + hasła
// ============================================================================

export type UserAccountStatus = 'locked' | 'warning' | 'active' | 'inactive';

export interface UserListItem {
  id: number;
  email: string;
  role: UserRole;
  role_display?: string;
  is_active: boolean;
  is_staff: boolean;
  account_status: UserAccountStatus;
  created_at: string;
}

export interface UserCreateData {
  email: string;
  password?: string;
  role: UserRole;
  is_active?: boolean;
  is_staff?: boolean;
}

export interface UserUpdateData {
  role?: UserRole;
  is_active?: boolean;
  is_staff?: boolean;
}

export interface PasswordResetData {
  new_password: string;
}

export interface PasswordChangeData {
  old_password: string;
  new_password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean;
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

// ✅ Profil klienta (RODO) — /clients/me/
export interface ClientMe {
  id: number;
  number: string | null;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string | null;
  phone: string | null;
  marketing_consent: boolean;
  preferred_contact: 'email' | 'sms' | 'phone' | 'none';
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientMeUpdateData {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  marketing_consent?: boolean;
  preferred_contact?: 'email' | 'sms' | 'phone' | 'none';
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
  promotion: Record<string, unknown> | string;
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
  promotion?: Record<string, unknown> | string;
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

/** Minimalny employee wg EmployeeSimpleSerializer */
export interface EmployeeSimple {
  id: number;
  number: string;
  full_name: string;
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

  timespan?: string;
  booking_channel?: string;
  client_notes?: string;
  internal_notes?: string;
  reminder_sent?: boolean;
  reminder_sent_at?: string | null;
}

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

export interface AppointmentCreateData {
  client?: string | null;
  employee: string;
  service: string;
  start: string;
  end?: string | null;
  booking_channel?: string;
  client_notes?: string;
  internal_notes?: string;
}

export interface AppointmentStatusUpdateData {
  status: AppointmentStatus;
  cancellation_reason?: string;
}

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
  stats?: Record<string, unknown>;
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
    today_appointments_count?: number;
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

export type DashboardResponse = ClientDashboardData | EmployeeDashboardData | ManagerDashboardData;

// ============================================================================
// TIME OFF
// ============================================================================

export type TimeOffStatus = 'pending' | 'approved' | 'rejected';
export type TimeOffType = 'vacation' | 'sick_leave' | 'other';

export interface TimeOff {
  id: number;
  employee: number;
  employee_full_name?: string;
  date_from: string;
  date_to: string;
  status: TimeOffStatus;
  status_display?: string;
  type: TimeOffType;
  type_display?: string;
  reason: string;

  approved_by?: number | null;
  approved_at?: string | null;

  days?: number | null;

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

export interface TimeOffApproveData {
  time_off: number;
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
  end_time: string; // HH:MM:SS
}

export type ScheduleBreak =
  | { start: string; end: string }
  | { weekday: number; start_time: string; end_time: string };

export interface Schedule {
  status: 'active' | 'inactive';
  availability_periods: ScheduleEntry[];
  breaks: ScheduleBreak[];
}

/** Schedule z backendowego ScheduleSerializer */
export interface ScheduleDetail extends Schedule {
  id: number;
  employee: number;
  employee_full_name?: string;
  created_at: string;
  updated_at: string;
}

/** Update wg ScheduleUpdateSerializer */
export interface ScheduleUpdateData {
  status?: 'active' | 'inactive';
  breaks?: ScheduleBreak[];
  availability_periods?: ScheduleEntry[];
}

// ============================================================================
// NOTES
// ============================================================================

export interface Note {
  id: number;
  appointment: number;
  author: number;
  author_email?: string;
  content: string;
  visible_for_client: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteCreateUpdateData {
  appointment: number;
  content: string;
  visible_for_client?: boolean;
}

// ============================================================================
// MEDIA
// ============================================================================

export type MediaAssetType = 'image' | 'document' | 'other' | string;

export interface MediaAsset {
  id: number;
  employee: number;
  employee_full_name?: string;
  file_url: string;
  type: MediaAssetType;
  file_name: string;
  size_bytes: number;
  is_active: boolean;
  description: string;
  mime_type: string;
  created_at: string;
  updated_at: string;
}

export interface MediaAssetCreateUpdateData {
  employee: number;
  file_url: string;
  type: MediaAssetType;
  file_name: string;
  size_bytes: number;
  is_active?: boolean;
  description?: string;
  mime_type?: string;
}

// ============================================================================
// PAYMENTS
// ============================================================================

export type PaymentStatus = 'pending' | 'paid' | 'deposit' | 'cancelled' | string;

export interface Payment {
  id: number;
  appointment: number;
  client_name: string | null;
  amount: string;
  status: PaymentStatus;
  status_display?: string;
  paid_at: string | null;
  method: string;
  type: string;
  reference: string;
  appointment_start: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentCreateData {
  client_number: string;
  appointment_start: string; // ISO
  amount: number;
  method?: string;
  type?: string;
  reference?: string;
}

export interface PaymentMarkAsPaidData {
  payment: number;
}

export interface PaymentMarkAsPaidResponse {
  detail: string;
  payment: Payment;
}

// ============================================================================
// INVOICES
// ============================================================================

export interface Invoice {
  id: number;
  number: string;
  client: number;
  client_name: string;
  appointment: number | null;
  issue_date: string;
  net_amount: string;
  vat_rate: string;
  vat_amount: string;
  gross_amount: string;
  is_paid: boolean;
  sale_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  pdf_file: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | string;

export interface Notification {
  id: number;
  client: number | null;
  client_name?: string | null;
  appointment: number | null;
  appointment_start?: string | null;
  type: string;
  channel: string;
  status: NotificationStatus;
  scheduled_at: string;
  subject: string;
  content: string;
  sent_at: string | null;
  error_message: string | null;
  attempts_count: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationCreateData {
  client: number | null;
  appointment: number | null;
  type: string;
  channel: string;
  scheduled_at: string;
  subject: string;
  content: string;
}

// ============================================================================
// REPORTS (PDF)
// ============================================================================

export interface ReportPDF {
  id: number;
  type: string;
  title: string;
  file_path: string;
  data_od: string | null;
  data_do: string | null;
  file_size: number;
  generated_by: number | null;
  generated_by_email?: string | null;
  parameters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export type AuditLogLevel = 'info' | 'warning' | 'error' | string;

export interface AuditLog {
  id: number;
  type: string;
  level: AuditLogLevel;
  level_display?: string;
  created_at: string;
  user: number | null;
  user_email?: string | null;
  message: string;
  adres_ip: string | null;
  user_agent: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

export interface SystemSettings {
  id: number;
  slot_minutes: number;
  buffer_minutes: number;
  deposit_policy: Record<string, unknown> | string;
  opening_hours: Record<string, unknown> | string;
  salon_name: string;
  address: string;
  phone: string;
  contact_email: string;
  default_vat_rate: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  last_modified_by: number | null;
  last_modified_by_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemSettingsPatchData {
  slot_minutes?: number;
  buffer_minutes?: number;
  deposit_policy?: Record<string, unknown> | string;
  opening_hours?: Record<string, unknown> | string;
  salon_name?: string;
  address?: string;
  phone?: string;
  contact_email?: string;
  default_vat_rate?: string;
  maintenance_mode?: boolean;
  maintenance_message?: string;
}

// ============================================================================
// STATS SNAPSHOTS
// ============================================================================

export interface StatsSnapshot {
  id: number;
  period: string;
  total_visits: number;
  date_from: string;
  date_to: string;
  completed_visits: number;
  cancellations: number;
  no_shows: number;
  revenue_total: string;
  revenue_deposits: string;
  new_clients: number;
  returning_clients: number;
  employees_occupancy_avg: string;
  extra_metrics: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// STATISTICS (GET /statistics/)
// ============================================================================

export interface StatisticsPeriod {
  days: number;
  from: string;
  to: string;
}

export interface StatisticsSummary {
  total_clients: number;
  new_clients: number;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  no_show_appointments: number;
  total_revenue: string;
}

export interface ServiceStatisticsItem {
  service: Service;
  total_appointments: number;
  total_revenue: string;
}

export interface EmployeeStatisticsItem {
  employee: EmployeeSimple;
  total_appointments: number;
  /**
   * % obłożenia (0-100). Backend zwykle zwraca string (DecimalField),
   * ale w aplikacji trzymamy jako number | null (parsujemy w warstwie API).
   */
  occupancy_percent: number | null;
  total_revenue: string;
}

export interface DailyStatisticsItem {
  date: string | null;
  appointments_count: number;
  revenue: string;
}

export interface StatisticsResponse {
  period: StatisticsPeriod;
  summary: StatisticsSummary;
  services: ServiceStatisticsItem[];
  employees: EmployeeStatisticsItem[];
  daily: DailyStatisticsItem[];
}
// ============================================================================
// BOOKING (POST /bookings/)
// ============================================================================

export interface BookingCreateData {
  employee: number;
  service: number;
  start: string; // ISO datetime
  notes?: string;
}

export interface BookingCreateResponse {
  detail: string;
  appointment: AppointmentDetail;
}
