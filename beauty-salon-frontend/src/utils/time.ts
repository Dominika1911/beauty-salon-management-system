export type TimePeriod = { start: string; end: string };

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeToHHMM(value: unknown): string | null {
    const raw = String(value ?? '').trim();

    const m = raw.match(/^([0-2]?\d):([0-5]\d)(?::[0-5]\d)?$/);
    if (!m) return null;

    const hour = Number(m[1]);
    const minute = m[2];

    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;

    const hh = String(hour).padStart(2, '0');
    const hhmm = `${hh}:${minute}`;
    return HHMM_RE.test(hhmm) ? hhmm : null;
}

export function isHHMM(value: unknown): boolean {
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
        return aStart - bStart;
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

        const startRaw = typeof anyItem.start === 'string' ? anyItem.start : '';
        const endRaw = typeof anyItem.end === 'string' ? anyItem.end : '';

        const start = normalizeToHHMM(startRaw);
        const end = normalizeToHHMM(endRaw);
        if (!start || !end) continue;

        out.push({ start, end });
    }
    return out;
}
