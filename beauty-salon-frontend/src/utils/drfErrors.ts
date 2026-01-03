export type DrfParsedError = {
    message?: string;
    fieldErrors?: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function firstStringFromUnknown(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        return typeof first === 'string' ? first : String(first);
    }
    return undefined;
}

export function parseDrfError(err: unknown): DrfParsedError {
    const e = err as { message?: unknown; response?: { data?: unknown } };
    const data = e.response?.data;

    if (!data) {
        return { message: typeof e.message === 'string' ? e.message : 'Wystąpił błąd.' };
    }

    if (typeof data === 'string') {
        return { message: data };
    }

    if (!isRecord(data)) {
        return { message: 'Wystąpił błąd.' };
    }

    const fieldErrors: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
        if (key === 'detail' || key === 'non_field_errors') continue;

        const msg = firstStringFromUnknown(value);
        if (msg) fieldErrors[key] = msg;
    }

    const detail = typeof data.detail === 'string' ? data.detail : undefined;
    const nonField =
        Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0
            ? String(data.non_field_errors[0])
            : undefined;

    const message = detail ?? nonField;

    return {
        message,
        fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    };
}

export function pickFieldErrors<T extends Record<string, unknown>>(
    fieldErrors: Record<string, string> | undefined,
    template: T,
): Partial<Record<keyof T, string>> {
    if (!fieldErrors) return {};

    const out: Partial<Record<keyof T, string>> = {};

    for (const [k, v] of Object.entries(fieldErrors)) {
        if (Object.prototype.hasOwnProperty.call(template, k)) {
            (out as Record<string, string>)[k] = v;
        }
    }

    return out;
}

