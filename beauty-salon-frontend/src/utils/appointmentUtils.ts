import { AppointmentStatus } from '@/types';

const PLN_FORMATTER = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

function isValidDate(d: Date): boolean {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

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


export function formatPrice(price?: string | number): string {
  if (price === null || price === undefined) return "—";
  const n = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(n)) return "—";
  return PLN_FORMATTER.format(n);
}

export function formatDateTimePL(iso: string | Date): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!isValidDate(d)) return "—";

  return d.toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function isPastAppointment(startDate: string | Date): boolean {
  if (!startDate) return false;
  const d = startDate instanceof Date ? startDate : new Date(startDate);
  if (!isValidDate(d)) return false;
  return d.getTime() < Date.now();
}