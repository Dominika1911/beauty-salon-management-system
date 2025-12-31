import type { DRFPaginated, Appointment, AppointmentStatus } from '@/types';

export const EMPTY_PAGE: DRFPaginated<Appointment> = {
    count: 0,
    next: null,
    previous: null,
    results: [],
};

export const formatPL = (dt: string) => {
    const d = new Date(dt);
    return Number.isNaN(d.getTime())
        ? dt
        : d.toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' });
};

export const formatPrice = (price?: string | number) => {
    if (price == null) return '—';
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(Number(price));
};

export const statusChipColor = (
    status: AppointmentStatus
): 'default' | 'warning' | 'success' | 'error' => {
    const colors: Partial<Record<AppointmentStatus, 'default' | 'warning' | 'success' | 'error'>> = {
        PENDING: 'warning',
        CONFIRMED: 'success',
        CANCELLED: 'error',
        NO_SHOW: 'error',
    };
    return colors[status] ?? 'default';
};
