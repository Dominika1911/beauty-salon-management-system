export interface ClientFormData {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    password: string;
    internal_notes: string;
    is_active: boolean;
}

export type SnackbarState = { open: boolean; msg: string; severity: 'success' | 'info' };
