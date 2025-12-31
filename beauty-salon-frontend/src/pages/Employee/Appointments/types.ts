import type { AlertColor } from '@mui/material/Alert';
import type { AppointmentStatus } from '@/types';

export type Ordering =
  | 'start'
  | '-start'
  | 'status'
  | '-status'
  | 'created_at'
  | '-created_at';

export type SnackState = { open: boolean; msg: string; severity: AlertColor };

export type FormData = {
  client: number | null;
  employee: number | null;
  service: number | null;
  start: Date | null;
  end: Date | null;
  status: AppointmentStatus;
  internal_notes: string;
};
export type EmployeeSelectItem = {
  id: number;
  label: string;
  skills: number[];
};
