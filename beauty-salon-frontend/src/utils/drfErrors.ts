export type DrfParsedError = {
    message: string;
    fieldErrors: Record<string, string>;
    status?: number;
};

type AxiosLikeError = {
    message?: unknown;
    response?: {
        status?: number;
        data?: unknown;
    };
};

function firstString(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        const first = value[0];
        return typeof first === 'string' ? first : first != null ? String(first) : undefined;
    }
    return undefined;
}

export function parseDrfError(err: unknown): DrfParsedError {
    const e: AxiosLikeError = (typeof err === 'object' && err !== null ? (err as AxiosLikeError) : {}) as any;

    const status = e.response?.status;
    const data = e.response?.data;

    const out: DrfParsedError = {
        status,
        fieldErrors: {},
        message: 'Wystąpił błąd.',
    };

    if (data === undefined) {
        if (typeof e.message === 'string' && e.message.trim()) out.message = e.message;
        return out;
    }

    if (typeof data === 'string') {
        out.message = data;
        return out;
    }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        if (typeof e.message === 'string' && e.message.trim()) out.message = e.message;
        return out;
    }

    const obj = data as Record<string, unknown>;

    const detail = obj.detail;
    if (typeof detail === 'string' && detail.trim()) {
        out.message = detail;
    }

    if (out.message === 'Wystąpił błąd.') {
        const nfe = obj.non_field_errors;
        const nfeMsg = firstString(nfe);
        if (nfeMsg) out.message = nfeMsg;
    }

    for (const [k, v] of Object.entries(obj)) {
        if (k === 'detail' || k === 'non_field_errors') continue;
        const msg = firstString(v);
        if (msg) out.fieldErrors[k] = msg;
    }

    if (out.message === 'Wystąpił błąd.') {
        const firstField = Object.values(out.fieldErrors)[0];
        if (firstField) out.message = firstField;
        else if (typeof e.message === 'string' && e.message.trim()) out.message = e.message;
    }

    return out;
}

export function pickFieldErrors<T extends Record<string, unknown>>(
    fieldErrors: Record<string, string> | undefined,
    shape: T,
): Partial<Record<keyof T, string>> {
    const out: Partial<Record<keyof T, string>> = {};
    if (!fieldErrors) return out;

    for (const k of Object.keys(shape) as Array<keyof T>) {
        const msg = fieldErrors[String(k)];
        if (typeof msg === 'string' && msg.trim()) out[k] = msg;
    }

    return out;
}
