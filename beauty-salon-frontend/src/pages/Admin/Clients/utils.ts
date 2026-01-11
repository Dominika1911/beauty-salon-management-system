import * as yup from 'yup';
import { parseDrfError } from '@/utils/drfErrors';

type ClientFormValues = {
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string | null;
    internal_notes?: string;
    is_active: boolean;
    password?: string;
};

type NormalizedClientValues = Omit<ClientFormValues, 'email'> & {
    /** Always explicit: either a trimmed string or null. Never undefined. */
    email: string | null;
};

type AxiosLikeError = {
    response?: { data?: unknown };
};

export type OrderingOption = { value: string; label: string };

/**
 * Keep ordering options strictly based on values already used in code.
 * Labels intentionally mirror values to avoid guessing UI copy.
 */
export const ORDERING_OPTIONS: OrderingOption[] = [{ value: '-created_at', label: '-created_at' }];

/** Backwards-compatible alias used by UI. */
export function getResponseData(err: unknown): unknown {
    return (err as AxiosLikeError | null | undefined)?.response?.data;
}

/** Backwards-compatible helper used by UI. */
export function getBestErrorMessage(err: unknown): string | undefined {
    const parsed = parseDrfError(err);
    return typeof parsed.message === 'string' && parsed.message.trim() ? parsed.message : undefined;
}

export function normalizeClientValues(values: ClientFormValues): NormalizedClientValues {
    const trimmed: NormalizedClientValues = {
        ...values,
        first_name: values.first_name?.trim(),
        last_name: values.last_name?.trim(),
        internal_notes: values.internal_notes?.trim(),
        is_active: values.is_active,
        password: values.password,
        // will be normalized below
        email: null,
    };

    const phone = values.phone?.trim();
    trimmed.phone = phone ? phone : undefined;

    const email = values.email?.trim();
    trimmed.email = email ? email : null;

    return trimmed;
}

export function buildClientCreatePayload(values: ClientFormValues) {
    const v = normalizeClientValues(values);
    return {
        first_name: v.first_name,
        last_name: v.last_name,
        phone: v.phone,
        email: v.email,
        internal_notes: v.internal_notes,
        is_active: v.is_active,
        password: v.password!,
    };
}

export function buildClientUpdatePayload(values: ClientFormValues) {
    const v = normalizeClientValues(values);
    return {
        first_name: v.first_name,
        last_name: v.last_name,
        phone: v.phone,
        email: v.email,
        internal_notes: v.internal_notes,
        is_active: v.is_active,
    };
}

export function getDrfData(err: unknown): unknown {
    if (!err) return undefined;
    return (err as AxiosLikeError).response?.data;
}

/**
 * Helper used in tests (and optionally in UI) to get the first human-readable string
 * from DRF error payload shapes.
 */
export function firstFromDrf(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        const first = value[0];
        return typeof first === 'string' ? first : null;
    }
    return null;
}

export function extractDrfMessage(data: unknown): string | undefined {
    if (!data) return undefined;
    if (typeof data === 'string') return data;

    if (Array.isArray(data)) {
        const first = data[0];
        if (typeof first === 'string') return first;
        return undefined;
    }

    if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;

        const detail = obj.detail;
        if (typeof detail === 'string') return detail;

        const nfe = obj.non_field_errors;
        if (Array.isArray(nfe) && nfe.length && typeof nfe[0] === 'string') return String(nfe[0]);

        for (const v of Object.values(obj)) {
            if (Array.isArray(v) && v.length && typeof v[0] === 'string') return String(v[0]);
            if (typeof v === 'string') return v;
        }
    }

    return undefined;
}

export function extractFieldErrors(data: unknown): Record<string, string> {
    const parsed = parseDrfError(data);
    return parsed.fieldErrors;
}

export const BaseClientSchema = yup.object({
    first_name: yup.string().trim().min(2).required(),
    last_name: yup.string().trim().min(2).required(),
    phone: yup
        .string()
        .trim()
        .matches(/^\+?[0-9 ]+$/, { message: 'Nieprawidłowy numer telefonu.', excludeEmptyString: true })
        .optional(),
    email: yup.string().trim().email('Nieprawidłowy email.').nullable().optional(),
    internal_notes: yup.string().trim().optional(),
    is_active: yup.boolean().required(),
});

export const CreateClientSchema = BaseClientSchema.shape({
    password: yup.string().min(8).required(),
});

/** Same rules as base schema; password is handled only for create. */
export const EditClientSchema = BaseClientSchema;
