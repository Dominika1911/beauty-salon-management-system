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
 * - EMPLOYEE: tworzy tylko własne wnioski (employee jest nadpisywane w perform_create)
 * - ADMIN: nie tworzy wniosków (frontend nie powinien tego wspierać)
 */
type TimeOffCreatePayload = {
  date_from: string;
  date_to: string;
  reason?: string;
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

  /**
   * POST /api/time-offs/{id}/cancel/
   * Backend: EMPLOYEE może anulować tylko swoje wnioski w statusie PENDING.
   * ADMIN: nie anuluje (frontend nie powinien tego wspierać).
   */
  cancel: async (id: number): Promise<TimeOff> => {
    const response = await axiosInstance.post<TimeOff>(`/time-offs/${id}/cancel/`);
    return response.data;
  },
};
