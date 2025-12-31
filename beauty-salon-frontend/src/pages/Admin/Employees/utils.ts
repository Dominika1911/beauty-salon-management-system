import type { GridSortModel } from '@mui/x-data-grid';
import type { Employee } from '@/types';
import type { EmployeeListItem } from '@/api/employees';

export const ORDERING_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '-created_at', label: 'Najnowsi' },
    { value: 'created_at', label: 'Najstarsi' },
    { value: 'last_name', label: 'Nazwisko (A→Z)' },
    { value: '-last_name', label: 'Nazwisko (Z→A)' },
    { value: 'employee_number', label: 'Nr pracownika (rosnąco)' },
    { value: '-employee_number', label: 'Nr pracownika (malejąco)' },
    { value: 'id', label: 'ID (rosnąco)' },
    { value: '-id', label: 'ID (malejąco)' },
];

/**  type-guard: ADMIN ma pełny EmployeeSerializer */
export function isEmployee(row: EmployeeListItem): row is Employee {
    return (row as Employee).employee_number !== undefined;
}

export function formatPLN(value: string | number) {
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) return '0,00 zł';
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
}

export function sortModelToOrdering(sortModel: GridSortModel): string | undefined {
    if (!sortModel || sortModel.length === 0) return undefined;

    const first = sortModel[0];
    const field = first.field;
    const direction = first.sort;

    const allowed = new Set(['id', 'employee_number', 'last_name', 'created_at']);
    if (!allowed.has(field)) return undefined;
    if (!direction) return undefined;

    return direction === 'desc' ? `-${field}` : field;
}

type AxiosLikeError = { response?: { data?: unknown } };
export function getResponseData(err: unknown): unknown {
    if (typeof err !== 'object' || err === null) return undefined;
    if (!('response' in err)) return undefined;
    return (err as AxiosLikeError).response?.data;
}

export function extractDrfMessage(data: unknown): string | undefined {
    if (!data) return undefined;
    if (typeof data === 'string') return data;

    if (Array.isArray(data)) {
        const first = data[0];
        if (typeof first === 'string') return first;
        return undefined;
    }

    if (typeof data === 'object') {
        const obj = data as Record<string, unknown>;

        const candidateKeys = ['detail', 'message', 'error', 'non_field_errors', 'errors'];
        for (const k of candidateKeys) {
            const v = obj[k];
            if (typeof v === 'string') return v;
            if (Array.isArray(v) && v.length && typeof v[0] === 'string') return String(v[0]);
        }

        const maybe0 = obj['0'];
        if (typeof maybe0 === 'string') return maybe0;

        const all = obj['__all__'];
        if (Array.isArray(all) && all.length && typeof all[0] === 'string') return String(all[0]);
    }

    return undefined;
}

export function mapEmployeeCreateMessage(msg: string): string {
    const m = msg.toLowerCase();

    const isLoginGeneratorProblem =
        m.includes('login') &&
        (m.includes('nie można wygenerować') ||
            m.includes('nie mozna wygenerowac') ||
            m.includes('unikalny') ||
            m.includes('już istnieje') ||
            m.includes('istnieje'));

    if (isLoginGeneratorProblem) {
        return 'Nie udało się utworzyć pracownika — system nie mógł wygenerować unikalnych danych konta. Spróbuj ponownie.';
    }

    return msg;
}
