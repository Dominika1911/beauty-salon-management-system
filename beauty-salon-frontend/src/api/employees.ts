import axiosInstance from '@/api/axios';
import type { DRFPaginated, Employee } from '@/types';


export type EmployeePublic = {
    id: number;
    employee_number: string | null;
    first_name: string;
    last_name: string;
    full_name: string;
};

export type EmployeeListItem = Employee | EmployeePublic;

export type WeeklyHours = Record<
    'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
    Array<{ start: string; end: string }>
>;

export interface EmployeeSchedule {
    id: number;
    employee: number;
    weekly_hours: Record<string, Array<{ start: string; end: string }>>; // zgodne z JSONField
    created_at: string;
    updated_at: string;
}

type EmployeeListParams = {
    is_active?: boolean;
    employee_number?: string;
    service_id?: number;
    search?: string;
    ordering?: string;
    page?: number;
};

type EmployeeCreatePayload = {
    first_name: string;
    last_name: string;
    phone?: string;
    skill_ids?: number[];
    email: string;
    password: string;
    is_active?: boolean;
};

type EmployeeUpdatePayload = Partial<EmployeeCreatePayload>;

export const employeesApi = {

    list: async (params?: EmployeeListParams): Promise<DRFPaginated<EmployeeListItem>> => {
        const response = await axiosInstance.get<DRFPaginated<EmployeeListItem>>('/employees/', {
            params,
        });
        return response.data;
    },

    get: async (id: number): Promise<EmployeeListItem> => {
        const response = await axiosInstance.get<EmployeeListItem>(`/employees/${id}/`);
        return response.data;
    },

    create: async (data: EmployeeCreatePayload): Promise<Employee> => {
        const response = await axiosInstance.post<Employee>('/employees/', data);
        return response.data;
    },

    update: async (id: number, data: EmployeeUpdatePayload): Promise<Employee> => {
        const response = await axiosInstance.patch<Employee>(`/employees/${id}/`, data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await axiosInstance.delete(`/employees/${id}/`);
    },

    getSchedule: async (employeeId: number): Promise<EmployeeSchedule> => {
        const response = await axiosInstance.get<EmployeeSchedule>(
            `/employees/${employeeId}/schedule/`,
        );
        return response.data;
    },

    updateSchedule: async (
        employeeId: number,
        weekly_hours: Record<string, Array<{ start: string; end: string }>>,
    ): Promise<EmployeeSchedule> => {
        const response = await axiosInstance.patch<EmployeeSchedule>(
            `/employees/${employeeId}/schedule/`,
            {
                weekly_hours,
            },
        );
        return response.data;
    },
};
