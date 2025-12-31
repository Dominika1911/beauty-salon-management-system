export function getErrorMessage(e: unknown, fallback = 'Wystąpił błąd'): string {
    const anyErr = e as any;
    const d = anyErr?.response?.data;

    if (typeof d?.detail === 'string') return d.detail;
    if (d && typeof d === 'object') {
        const k = Object.keys(d)[0];
        const v = d[k];
        if (Array.isArray(v) && v.length) return String(v[0]);
        if (typeof v === 'string') return v;
    }
    return anyErr?.message || fallback;
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
