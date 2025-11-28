// src/types/index.ts

export interface User {
  id: number;
  email: string;
  role: 'manager' | 'employee' | 'client';
  role_display: string;
  is_active: boolean;
  is_staff: boolean;
  employee_id?: number;
  client_id?: number;
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
}