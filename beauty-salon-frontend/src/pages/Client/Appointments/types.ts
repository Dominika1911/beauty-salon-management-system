import type { AlertColor } from '@mui/material/Alert';
import type { AppointmentStatus } from '@/types';

export type StatusFilter = AppointmentStatus | 'ALL';

export type Ordering =
    | 'start'
    | '-start'
    | 'status'
    | '-status'
    | 'created_at'
    | '-created_at';

export type SnackState = { open: boolean; msg: string; severity: AlertColor };
