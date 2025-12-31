import * as Yup from 'yup';

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
