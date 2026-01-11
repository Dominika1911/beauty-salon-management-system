export type DrfParsedError = {
    /** Human-readable message suitable for showing to the user (always present). */
    message: string;
    /** Field-level errors: fieldName -> first error message */
    fieldErrors: Record<string, string>;
    /** HTTP status when available */
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

/**
 * Parses DRF-style error responses (and also handles generic JS/axios errors) into a deterministic structure.
 *
 * Rules (in order):
 * - If response.data is a string -> message = that string
 * - If response.data.detail is a string -> message = detail
 * - If response.data.non_field_errors is an array -> message = first item
 * - Field errors are collected from other keys (excluding detail/non_field_errors)
 * - If message still empty but there are field errors -> message = first field error
 * - Fallback -> Error.message or "Wystąpił błąd."
 */
export function parseDrfError(err: unknown): DrfParsedError {
    const e: AxiosLikeError = (typeof err === 'object' && err !== null ? (err as AxiosLikeError) : {}) as any;

    const status = e.response?.status;
    const data = e.response?.data;

    const out: DrfParsedError = {
        status,
        fieldErrors: {},
        message: 'Wystąpił błąd.',
    };

    // If we have no response data at all, fall back to error.message when present.
    if (data === undefined) {
        if (typeof e.message === 'string' && e.message.trim()) out.message = e.message;
        return out;
    }

    // response.data as a plain string
    if (typeof data === 'string') {
        out.message = data;
        return out;
    }

    // Unexpected primitive / array / null shapes: keep deterministic fallback message.
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        if (typeof e.message === 'string' && e.message.trim()) out.message = e.message;
        return out;
    }

    const obj = data as Record<string, unknown>;

    // Prefer detail
    const detail = obj.detail;
    if (typeof detail === 'string' && detail.trim()) {
        out.message = detail;
    }

    // Or non_field_errors
    if (out.message === 'Wystąpił błąd.') {
        const nfe = obj.non_field_errors;
        const nfeMsg = firstString(nfe);
        if (nfeMsg) out.message = nfeMsg;
    }

    // Field errors: collect only real fields (exclude detail/non_field_errors)
    for (const [k, v] of Object.entries(obj)) {
        if (k === 'detail' || k === 'non_field_errors') continue;
        const msg = firstString(v);
        if (msg) out.fieldErrors[k] = msg;
    }

    // If we still don't have a specific message, use the first field error.
    if (out.message === 'Wystąpił błąd.') {
        const firstField = Object.values(out.fieldErrors)[0];
        if (firstField) out.message = firstField;
        else if (typeof e.message === 'string' && e.message.trim()) out.message = e.message;
    }

    return out;
}

/**
 * Picks only known fields from parsed.fieldErrors.
 * The `shape` object is the source of truth: if a field is not in shape, it is ignored.
 */
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
