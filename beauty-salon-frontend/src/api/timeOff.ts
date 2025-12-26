// src/api/timeOff.ts
import axiosInstance from "@/api/axios";
import type { DRFPaginated, TimeOff, TimeOffStatus } from "@/types";

/**
 * Backend (TimeOffViewSet):
 * - filterset_fields = ["status", "employee"]
 * - ordering_fields = ["created_at", "date_from", "date_to", "status"]
 * - search_fields = ["reason", "employee__first_name", "employee__last_name"]
 *
 * Dodatkowo custom query params w get_queryset:
 * - date_from, date_to (YYYY-MM-DD)
 */
type TimeOffListParams = {
  status?: TimeOffStatus;
  employee?: number;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  search?: string; // DRF SearchFilter
  ordering?: string;
  page?: number;
};

/**
 * Dane potrzebne do utworzenia wniosku o wolne
 * Backend:
 * - EMPLOYEE: employee i tak jest nadpisywane w perform_create
 * - ADMIN: employee jest wymagane (backend waliduje)
 */
type TimeOffCreatePayload = {
  date_from: string;
  date_to: string;
  reason?: string;
  employee?: number;
};

/**
 * Dane do aktualizacji (PATCH)
 * Backend: update/partial_update tylko ADMIN (get_permissions)
 */
type TimeOffUpdatePayload = {
  date_from?: string;
  date_to?: string;
  reason?: string;
  status?: TimeOffStatus; // backend pozwala ADMIN edytować status przez update (serializer ma pole status)
};

export const timeOffApi = {
  /**
   * GET /api/time-offs/
   * DRF PageNumberPagination -> DRFPaginated<TimeOff>
   */
  list: async (params?: TimeOffListParams): Promise<DRFPaginated<TimeOff>> => {
    const response = await axiosInstance.get<DRFPaginated<TimeOff>>("/time-offs/", { params });
    return response.data;
  },

  /**
   * GET /api/time-offs/{id}/
   */
  get: async (id: number): Promise<TimeOff> => {
    const response = await axiosInstance.get<TimeOff>(`/time-offs/${id}/`);
    return response.data;
  },

  /**
   * POST /api/time-offs/
   */
  create: async (data: TimeOffCreatePayload): Promise<TimeOff> => {
    const response = await axiosInstance.post<TimeOff>("/time-offs/", data);
    return response.data;
  },

  /**
   * PATCH /api/time-offs/{id}/
   */
  update: async (id: number, data: TimeOffUpdatePayload): Promise<TimeOff> => {
    const response = await axiosInstance.patch<TimeOff>(`/time-offs/${id}/`, data);
    return response.data;
  },

  /**
   * DELETE /api/time-offs/{id}/
   */
  remove: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/time-offs/${id}/`);
  },

  /**
   * POST /api/time-offs/{id}/approve/
   */
  approve: async (id: number): Promise<TimeOff> => {
    const response = await axiosInstance.post<TimeOff>(`/time-offs/${id}/approve/`);
    return response.data;
  },

  /**
   * POST /api/time-offs/{id}/reject/
   */
  reject: async (id: number): Promise<TimeOff> => {
    const response = await axiosInstance.post<TimeOff>(`/time-offs/${id}/reject/`);
    return response.data;
  },
};
