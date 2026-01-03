export type TimePeriod = { start: string; end: string };

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isHHMM(value: string): boolean {
    return HHMM_RE.test(String(value ?? '').trim());
}

export function hhmmToMinutes(hhmm: string): number {
    const [h, m] = String(hhmm).split(':').map((n) => Number(n));
    return h * 60 + m;
}

export function sortPeriods<T extends TimePeriod>(periods: T[]): T[] {
    return [...periods].sort((a, b) => {
        const aStart = hhmmToMinutes(a.start);
        const bStart = hhmmToMinutes(b.start);
        if (aStart !== bStart) return aStart - bStart;
        return hhmmToMinutes(a.end) - hhmmToMinutes(b.end);
    });
}

export function hasOverlaps(periods: TimePeriod[]): boolean {
    const sorted = sortPeriods(periods);
    for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (hhmmToMinutes(cur.start) < hhmmToMinutes(prev.end)) return true;
    }
    return false;
}

export function sanitizePeriods(input: unknown): TimePeriod[] {
    if (!Array.isArray(input)) return [];

    const out: TimePeriod[] = [];
    for (const item of input) {
        if (!item || typeof item !== 'object') continue;
        const anyItem = item as { start?: unknown; end?: unknown };

        const start = typeof anyItem.start === 'string' ? anyItem.start.trim() : '';
        const end = typeof anyItem.end === 'string' ? anyItem.end.trim() : '';
        if (!start || !end) continue;

        out.push({ start, end });
    }
    return out;
}
