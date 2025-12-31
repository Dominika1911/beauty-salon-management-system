export type EmployeeFormState = {
    id?: number;
    first_name: string;
    last_name: string;
    phone: string;
    is_active: boolean;
    skill_ids: number[];
    email: string; // create: wymagany
    password: string; // create: wymagany
};

export const emptyForm: EmployeeFormState = {
    first_name: '',
    last_name: '',
    phone: '',
    is_active: true,
    skill_ids: [],
    email: '',
    password: '',
};

export type FieldErrors = Partial<Record<keyof EmployeeFormState, string>>;

export type SnackbarState = { open: boolean; msg: string; severity: 'success' | 'info' };

export type IsActiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
