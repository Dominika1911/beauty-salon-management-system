import type { AppointmentStatus } from '@/types';

export function statusChipColor(
  status: AppointmentStatus,
): 'default' | 'success' | 'warning' | 'error' | 'primary' {
  switch (status) {
    case 'CONFIRMED':
      return 'primary';
    case 'PENDING':
      return 'warning';
    case 'CANCELLED':
      return 'error';
    case 'COMPLETED':
      return 'success';
    case 'NO_SHOW':
      return 'error';
    default:
      return 'default';
  }
}

export function formatPL(dt: string): string {
  const d = new Date(dt);
  return Number.isNaN(d.getTime())
    ? dt
    : d.toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' });
}

export function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Oczekuje';
    case 'CONFIRMED':
      return 'Potwierdzona';
    case 'COMPLETED':
      return 'Zakończona';
    case 'CANCELLED':
      return 'Anulowana';
    case 'NO_SHOW':
      return 'No-show';
    default:
      return status;
  }
}
