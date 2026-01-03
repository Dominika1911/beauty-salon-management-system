import type { GridSortModel } from '@mui/x-data-grid';
import type { Employee } from '@/types';
import type { EmployeeListItem } from '@/api/employees';
import { parseDrfError } from '@/utils/drfErrors';

import type { EmployeeFormState, FieldErrors } from './types';

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

/** type-guard: ADMIN ma pełny EmployeeSerializer */
export function isEmployee(row: EmployeeListItem): row is Employee {
    return (row as Employee).employee_number !== undefined;
}

export function formatPLN(value: string | number): string {
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

/** Jawna walidacja formularza (UI blokuje wysyłkę). */
export function validateEmployeeForm(
    form: EmployeeFormState,
    isEdit: boolean,
): { ok: true } | { ok: false; formError: string; fieldErrors?: FieldErrors } {
    const fieldErrors: FieldErrors = {};

    if (!form.first_name.trim()) fieldErrors.first_name = 'Wymagane.';
    if (!form.last_name.trim()) fieldErrors.last_name = 'Wymagane.';

    if (!isEdit) {
        if (!form.email.trim()) fieldErrors.email = 'Wymagane.';
        if (!form.password.trim()) fieldErrors.password = 'Wymagane.';
        if (form.password.trim() && form.password.trim().length < 8) {
            fieldErrors.password = 'Minimum 8 znaków.';
        }
    }

    if (Object.keys(fieldErrors).length) {
        return { ok: false, formError: 'Uzupełnij wymagane pola.', fieldErrors };
    }

    return { ok: true };
}

// ------ payload types (zgodne z api/employees.ts) ------
export type EmployeeCreatePayload = {
    first_name: string;
    last_name: string;
    phone?: string;
    skill_ids?: number[];
    email: string;
    password: string;
    is_active?: boolean;
};

export type EmployeeUpdatePayload = Partial<EmployeeCreatePayload>;

/**
 * Overloady są kluczowe: TS wtedy wie, co zwraca funkcja przy true/false.
 */
export function buildEmployeePayload(form: EmployeeFormState, isEdit: false): EmployeeCreatePayload;
export function buildEmployeePayload(form: EmployeeFormState, isEdit: true): EmployeeUpdatePayload;
export function buildEmployeePayload(
    form: EmployeeFormState,
    isEdit: boolean,
): EmployeeCreatePayload | EmployeeUpdatePayload {
    const base: EmployeeUpdatePayload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || undefined,
        is_active: form.is_active,
        skill_ids: form.skill_ids,
    };

    if (!isEdit) {
        return {
            ...(base as EmployeeUpdatePayload),
            email: form.email.trim(),
            password: form.password,
        };
    }

    return base;
}

/** Jedno miejsce na „najlepszy” komunikat błędu z DRF. */
export function getBestErrorMessage(e: unknown): string | undefined {
    const parsed = parseDrfError(e);
    return parsed.message || extractDrfMessage(getResponseData(e));
}
