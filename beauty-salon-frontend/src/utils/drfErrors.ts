export type DrfParsedError = {
    message?: string;
    fieldErrors?: Record<string, string>;
};

export function parseDrfError(err: unknown): DrfParsedError {
    const e = err as any;
    const data = e?.response?.data;

    if (!data) {
        return { message: e?.message || 'Wystąpił błąd.' };
    }

    if (typeof data === 'string') {
        return { message: data };
    }

    const fieldErrors: Record<string, string> = {};

    if (typeof data === 'object') {
        for (const [key, value] of Object.entries<any>(data)) {
            if (key === 'detail' || key === 'non_field_errors') continue;

            if (Array.isArray(value) && value.length) {
                fieldErrors[key] = String(value[0]);
            } else if (typeof value === 'string') {
                fieldErrors[key] = value;
            }
        }
    }

    const message =
        data?.detail ||
        (Array.isArray(data?.non_field_errors) ? data.non_field_errors[0] : undefined);

    return {
        message,
        fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    };
}

export function pickFieldErrors<T extends Record<string, any>>(
    fieldErrors: Record<string, string> | undefined,
    template: T,
): Partial<Record<keyof T, string>> {
    if (!fieldErrors) return {};
    const out: Partial<Record<keyof T, string>> = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
        if (k in template) (out as any)[k] = v;
    }
    return out;
}
