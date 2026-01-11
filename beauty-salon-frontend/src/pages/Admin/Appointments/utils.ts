import type { AppointmentStatus } from '@/types';
import { APPOINTMENT_STATUSES } from '@/types';

export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function toIsoString(date: Date): string {
  return date.toISOString();
}

export function toYyyyMmDd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeStatus(status: unknown): AppointmentStatus | null {
  if (typeof status !== 'string') return null;
  return (APPOINTMENT_STATUSES as string[]).includes(status) ? (status as AppointmentStatus) : null;
}

export function canEmployeeDoService(employeeSkills: unknown, serviceId: unknown): boolean {
  if (!Array.isArray(employeeSkills)) return false;
  if (typeof serviceId !== 'number') return false;
  return employeeSkills.includes(serviceId);
}

export function friendlyAvailabilityError(reason?: string): string {
  if (reason && reason.trim().length > 0) return reason;
  return 'Wybrany termin jest niedostępny. Wybierz inny termin lub innego pracownika.';
}
