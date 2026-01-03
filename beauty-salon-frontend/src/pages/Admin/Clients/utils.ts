import * as Yup from 'yup';
import { parseDrfError } from '@/utils/drfErrors';
import type { ClientFormData } from './types';

export const ORDERING_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '-created_at', label: 'Najnowsi' },
    { value: 'created_at', label: 'Najstarsi' },
    { value: 'last_name', label: 'Nazwisko (A→Z)' },
    { value: '-last_name', label: 'Nazwisko (Z→A)' },
    { value: 'client_number', label: 'Nr klienta (rosnąco)' },
    { value: '-client_number', label: 'Nr klienta (malejąco)' },
    { value: 'id', label: 'ID (rosnąco)' },
    { value: '-id', label: 'ID (malejąco)' },
];

export const BaseClientSchema = Yup.object().shape({
    first_name: Yup.string()
        .min(2, 'Imię musi mieć co najmniej 2 znaki')
        .required('Imię jest wymagane'),
    last_name: Yup.string()
        .min(2, 'Nazwisko musi mieć co najmniej 2 znaki')
        .required('Nazwisko jest wymagane'),
    phone: Yup.string()
        .matches(/^\+?\d{9,15}$/, 'Telefon musi mieć 9–15 cyfr (może zaczynać się od +).')
        .notRequired(),
    email: Yup.string().email('Nieprawidłowy adres e-mail').notRequired(),
    internal_notes: Yup.string()
        .max(1000, 'Notatki mogą mieć maksymalnie 1000 znaków')
        .notRequired(),
    is_active: Yup.boolean(),
});

export const CreateClientSchema = BaseClientSchema.shape({
    password: Yup.string()
        .min(8, 'Hasło musi mieć co najmniej 8 znaków')
        .required('Hasło jest wymagane'),
});

export const EditClientSchema = BaseClientSchema.shape({
    password: Yup.string().notRequired(),
});

export function firstFromDrf(v: unknown): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && v.length) return String(v[0]);
    return null;
}

// -------------------- DRF error helpers --------------------
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

        const detail = obj.detail;
        if (typeof detail === 'string') return detail;

        const nfe = obj.non_field_errors;
        if (Array.isArray(nfe) && nfe.length && typeof nfe[0] === 'string') return String(nfe[0]);

        // pierwszy string z dowolnego pola
        for (const v of Object.values(obj)) {
            if (typeof v === 'string') return v;
            if (Array.isArray(v) && v.length && typeof v[0] === 'string') return String(v[0]);
        }
    }

    return undefined;
}

export function getBestErrorMessage(err: unknown): string | undefined {
    const parsed = parseDrfError(err);
    return parsed.message || extractDrfMessage(getResponseData(err));
}

// -------------------- payload helpers (kontrakt FE->BE) --------------------
type NormalizedClientValues = {
    first_name: string;
    last_name: string;
    phone?: string;
    email: string | null;
    internal_notes: string;
    is_active: boolean;
    password: string; // tylko create; przy edit ignorujemy
};

export function normalizeClientValues(values: ClientFormData): NormalizedClientValues {
    const emailToSend: string | null = values.email.trim() ? values.email.trim() : null;

    return {
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        phone: values.phone.trim() || undefined,
        email: emailToSend,
        internal_notes: values.internal_notes.trim(),
        is_active: values.is_active,
        password: values.password || '',
    };
}

export type ClientCreatePayload = {
    first_name: string;
    last_name: string;
    phone?: string;
    email: string | null;
    internal_notes: string;
    password: string;
    is_active: boolean;
};

export type ClientUpdatePayload = {
    first_name: string;
    last_name: string;
    phone?: string;
    email: string | null;
    internal_notes: string;
    is_active: boolean;
};

export function buildClientCreatePayload(values: ClientFormData): ClientCreatePayload {
    const v = normalizeClientValues(values);
    return {
        first_name: v.first_name,
        last_name: v.last_name,
        phone: v.phone,
        email: v.email,
        internal_notes: v.internal_notes,
        password: v.password,
        is_active: v.is_active,
    };
}

export function buildClientUpdatePayload(values: ClientFormData): ClientUpdatePayload {
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
