import { AppointmentStatus } from '@/types';

export const statusColor = (status: AppointmentStatus): "default" | "success" | "warning" | "error" => {
    switch (status) {
        case 'CONFIRMED':
            return 'success';
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
};

export const statusLabel = (status: AppointmentStatus | string): string => {
    const labels: Record<string, string> = {
        PENDING: 'Oczekuje',
        CONFIRMED: 'Potwierdzona',
        COMPLETED: 'Zakończona',
        CANCELLED: 'Anulowana',
        NO_SHOW: 'No-show',
    };
    return labels[status as string] || status;
};

export const formatPrice = (price?: string | number): string => {
    if (price == null) return '—';
    const n = Number(price);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
    }).format(n);
};

export const formatDateTimePL = (iso: string | Date): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? String(iso)
        : d.toLocaleString('pl-PL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
};

export const isPastAppointment = (startDate: string | Date): boolean => {
    return new Date(startDate).getTime() < Date.now();
};