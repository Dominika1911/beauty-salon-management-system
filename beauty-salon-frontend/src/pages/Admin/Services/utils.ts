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
