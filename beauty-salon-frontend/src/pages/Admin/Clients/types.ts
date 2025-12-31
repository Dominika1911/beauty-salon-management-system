export interface ClientFormData {
    first_name: string;
    last_name: string;
    phone: string;
    email: string; // UI string; wysyłamy "" -> null
    password: string; // Formik initialValues zawsze ma string (przy edycji zostaje "")
    internal_notes: string;
    is_active: boolean;
}

export type SnackbarState = { open: boolean; msg: string; severity: 'success' | 'info' };
