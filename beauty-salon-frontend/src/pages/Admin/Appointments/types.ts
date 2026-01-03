import type { AppointmentStatus } from '@/types';

export type StatusFilter = 'ALL' | AppointmentStatus;

export type ClientSelectItem = {
  id: number;
  label: string;
};

export type EmployeeSelectItem = {
  id: number;
  label: string;
  skills: number[];
};

export type ServiceSelectItem = {
  id: number;
  name: string;
  duration_minutes: number;
  price: number;
};

export type AdminAppointmentFormData = {
  client: number | null;
  employee: number | null;
  service: number | null;
  start: Date | null;
  status: AppointmentStatus;
  internal_notes: string;
};

export type Slot = {
  start: string;
  end: string;
};
