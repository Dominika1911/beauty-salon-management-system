import type { AppointmentStatus } from '@/types';
import { APPOINTMENT_STATUSES } from '@/types';

/**
 * Uwaga: nie próbujemy odtwarzać logiki backendu (buffer, grafiki itp.)
 * Tam gdzie to ma znaczenie, pytamy backend (check-availability / slots).
 */

export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function toIsoString(date: Date): string {
  // Backend DRF akceptuje ISO 8601 (z timezone). Date.toISOString() jest bezpieczne.
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
  // TS: AppointmentStatus jest zgodny z APPOINTMENT_STATUSES
  return (APPOINTMENT_STATUSES as string[]).includes(status) ? (status as AppointmentStatus) : null;
}

export function canEmployeeDoService(employeeSkills: number[] | undefined, serviceId: number): boolean {
  if (!Array.isArray(employeeSkills)) return false;
  return employeeSkills.includes(serviceId);
}

export function friendlyAvailabilityError(reason?: string): string {
  // Backend zwraca już "reason" user-friendly; defensywnie dodajemy fallback.
  if (reason && reason.trim().length > 0) return reason;
  return 'Wybrany termin jest niedostępny. Wybierz inny termin lub innego pracownika.';
}

export function isStartInSlots(
  start: Date,
  slots: string[] | Array<{ start: string; end: string }>,
): boolean {
  if (!isValidDate(start)) return false;
  const startMs = Math.floor(start.getTime() / 60000);

  // slots jako string[]
  if (Array.isArray(slots) && typeof slots[0] === 'string') {
    return (slots as string[]).some((s) => {
      const d = new Date(s);
      if (!isValidDate(d)) return false;
      return Math.floor(d.getTime() / 60000) === startMs;
    });
  }

  // slots jako Array<{start,end}>
  return (slots as Array<{ start: string; end: string }>).some((slot) => {
    const d = new Date(slot.start);
    if (!isValidDate(d)) return false;
    return Math.floor(d.getTime() / 60000) === startMs;
  });
}
