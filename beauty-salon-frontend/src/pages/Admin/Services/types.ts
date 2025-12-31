export type FormState = {
    name: string;
    category: string;
    description: string;
    price: string;
    duration_minutes: string;
    is_active: boolean;
};

export const emptyForm: FormState = {
    name: '',
    category: '',
    description: '',
    price: '0',
    duration_minutes: '30',
    is_active: true,
};

export type SortKey = 'name' | 'price' | 'duration_minutes' | 'created_at';
export type SortDir = 'asc' | 'desc';
export type IsActiveFilter = 'all' | 'active' | 'disabled';

export type SnackbarState = {
    open: boolean;
    msg: string;
    severity: 'success' | 'info';
};

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
    { value: 'name', label: 'Nazwa' },
    { value: 'price', label: 'Cena' },
    { value: 'duration_minutes', label: 'Czas' },
    { value: 'created_at', label: 'Data utworzenia' },
];
