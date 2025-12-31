import type { AppointmentStatus } from '@/types';

/* ====== SELECT ITEMS (UI MODELS) ====== */

export type EmployeeSelectItem = {
  id: number;
  label: string;
  skills: number[];
};

export type ClientSelectItem = {
  id: number;
  label: string;
};

export type ServiceSelectItem = {
  id: number;
  name: string;
  duration_minutes: number;
  price: number;
};

/* ====== FORM ====== */

export type AdminAppointmentFormData = {
  client: number | null;
  employee: number | null;
  service: number | null;
  start: Date | null;
  status: AppointmentStatus;
  internal_notes: string;
};

/* ====== FILTERS ====== */

export type StatusFilter = AppointmentStatus | 'ALL';
