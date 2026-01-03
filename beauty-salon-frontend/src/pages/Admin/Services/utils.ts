import { parseDrfError } from '@/utils/drfErrors';
import type { FormState } from './types';

export function validateServiceForm(form: FormState): {
    valid: boolean;
    errors: Partial<Record<keyof FormState, string>>;
} {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) next.name = 'Nazwa jest wymagana.';

    const priceNum = Number(form.price);
    if (form.price.trim() === '') next.price = 'Cena jest wymagana.';
    else if (Number.isNaN(priceNum) || priceNum < 0) next.price = 'Cena musi być liczbą ≥ 0.';

    const dur = Number(form.duration_minutes);
    if (form.duration_minutes.trim() === '') next.duration_minutes = 'Czas trwania jest wymagany.';
    else if (Number.isNaN(dur) || dur < 5) next.duration_minutes = 'Czas trwania musi być ≥ 5 minut.';

    return { valid: Object.keys(next).length === 0, errors: next };
}

// ---- helpers do DRF error ----
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

        for (const v of Object.values(obj)) {
            if (Array.isArray(v) && v.length && typeof v[0] === 'string') return String(v[0]);
            if (typeof v === 'string') return v;
        }
    }

    return undefined;
}

export function getBestErrorMessage(e: unknown): string | undefined {
    const parsed = parseDrfError(e);
    return parsed.message || extractDrfMessage(getResponseData(e));
}

// ---- payload builder (spójny kontrakt FE->BE) ----
export type ServiceCreatePayload = {
    name: string;
    category?: string;
    description?: string;
    price: number | string;
    duration_minutes: number;
    is_active?: boolean;
};
export type ServiceUpdatePayload = Partial<ServiceCreatePayload>;

export function buildServicePayload(form: FormState): ServiceCreatePayload {
    // validateServiceForm() gwarantuje, że duration_minutes i price są liczbami >= 0
    const dur = Number(form.duration_minutes);

    return {
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        description: form.description.trim() || undefined,
        price: String(form.price), // DecimalField w DRF przyjmie string/number
        duration_minutes: dur,
        is_active: form.is_active,
    };
}
