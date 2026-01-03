import { parseDrfError } from '@/utils/drfErrors';

export function getErrorMessage(e: unknown, fallback = 'Wystąpił błąd'): string {
    const parsed = parseDrfError(e);
    return parsed.message || fallback;
}

export function toLocalISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function formatTimeRange(start: string, end: string): string {
    const s = new Date(start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const e = new Date(end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    return `${s} – ${e}`;
}
