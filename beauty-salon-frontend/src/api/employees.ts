import axiosInstance from "@/api/axios";
import type { DRFPaginated, Employee } from "@/types";

/**
 * Widok publiczny (CLIENT)
 * Zgodny z EmployeePublicSerializer
 */
export type EmployeePublic = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
};

export type EmployeeListItem = Employee | EmployeePublic;

export type WeeklyHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  Array<{ start: string; end: string }>
>;

export interface EmployeeSchedule {
  id: number;
  employee: number;
  weekly_hours: Record<string, Array<{ start: string; end: string }>>; // zgodne z JSONField
  created_at: string;
  updated_at: string;
}

/**
 * Backend (EmployeeViewSet):
 * - filterset_fields = ["is_active", "employee_number"]
 * - search_fields = ["employee_number", "first_name", "last_name"]
 * - ordering_fields = ["id", "employee_number", "last_name", "created_at"]
 *
 * Dodatkowo custom query param:
 * - service_id (ręcznie w get_queryset)
 */
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

  // write-only -> source="skills"
  skill_ids?: number[];

  // write-only w serializerze (wymagane przy create)
  email: string;
  password: string;

  is_active?: boolean;
};

type EmployeeUpdatePayload = Partial<EmployeeCreatePayload>;

export const employeesApi = {
  /**
   * GET /api/employees/
   * DRF PageNumberPagination -> DRFPaginated<EmployeeListItem>
   */
  list: async (params?: EmployeeListParams): Promise<DRFPaginated<EmployeeListItem>> => {
    const response = await axiosInstance.get<DRFPaginated<EmployeeListItem>>("/employees/", { params });
    return response.data;
  },

  /**
   * GET /api/employees/{id}/
   * Uwaga: dla CLIENT backend zwraca EmployeePublicSerializer
   */
  get: async (id: number): Promise<EmployeeListItem> => {
    const response = await axiosInstance.get<EmployeeListItem>(`/employees/${id}/`);
    return response.data;
  },

  /**
   * POST /api/employees/
   */
  create: async (data: EmployeeCreatePayload): Promise<Employee> => {
    const response = await axiosInstance.post<Employee>("/employees/", data);
    return response.data;
  },

  /**
   * PATCH /api/employees/{id}/
   */
  update: async (id: number, data: EmployeeUpdatePayload): Promise<Employee> => {
    const response = await axiosInstance.patch<Employee>(`/employees/${id}/`, data);
    return response.data;
  },

  /**
   * DELETE /api/employees/{id}/
   */
  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/employees/${id}/`);
  },

  /**
   * GET /api/employees/{id}/schedule/
   */
  getSchedule: async (employeeId: number): Promise<EmployeeSchedule> => {
    const response = await axiosInstance.get<EmployeeSchedule>(`/employees/${employeeId}/schedule/`);
    return response.data;
  },

  /**
   * PATCH /api/employees/{id}/schedule/
   */
  updateSchedule: async (
    employeeId: number,
    weekly_hours: Record<string, Array<{ start: string; end: string }>>
  ): Promise<EmployeeSchedule> => {
    const response = await axiosInstance.patch<EmployeeSchedule>(`/employees/${employeeId}/schedule/`, {
      weekly_hours,
    });
    return response.data;
  },
};
