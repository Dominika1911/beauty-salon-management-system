import axiosInstance from "@/api/axios";
import type { DRFPaginated, Service } from "@/types";

/**
 * Backend (ServiceViewSet):
 * - filterset_fields = ["is_active", "category"]
 * - search_fields = ["name", "category", "description"]
 * - ordering_fields = ["id", "name", "price", "duration_minutes", "created_at"]
 */
type ServiceListParams = {
  is_active?: boolean;
  category?: string;
  search?: string;
  ordering?: string;
  page?: number;
};

type ServiceCreatePayload = {
  name: string;
  category?: string;
  description?: string;
  price: number | string; // DRF DecimalField przyjmie string/number, zwraca string
  duration_minutes: number;
  is_active?: boolean;
};

type ServiceUpdatePayload = Partial<ServiceCreatePayload>;

export const servicesApi = {
  /**
   * GET /api/services/
   * DRF PageNumberPagination -> DRFPaginated<Service>
   */
  list: async (params?: ServiceListParams): Promise<DRFPaginated<Service>> => {
    const response = await axiosInstance.get<DRFPaginated<Service>>("/services/", { params });
    return response.data;
  },

  /**
   * GET /api/services/{id}/
   */
  get: async (id: number): Promise<Service> => {
    const response = await axiosInstance.get<Service>(`/services/${id}/`);
    return response.data;
  },

  /**
   * POST /api/services/
   */
  create: async (data: ServiceCreatePayload): Promise<Service> => {
    const response = await axiosInstance.post<Service>("/services/", data);
    return response.data;
  },

  /**
   * PATCH /api/services/{id}/
   */
  update: async (id: number, data: ServiceUpdatePayload): Promise<Service> => {
    const response = await axiosInstance.patch<Service>(`/services/${id}/`, data);
    return response.data;
  },

  /**
   * DELETE /api/services/{id}/
   */
  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/services/${id}/`);
  },

  /**
   * POST /api/services/{id}/disable/
   * Backend zwraca: {"detail": "..."}
   */
  disable: async (id: number): Promise<{ detail: string }> => {
    const response = await axiosInstance.post<{ detail: string }>(`/services/${id}/disable/`);
    return response.data;
  },

  /**
   * POST /api/services/{id}/enable/
   * Backend zwraca: {"detail": "..."}
   */
  enable: async (id: number): Promise<{ detail: string }> => {
    const response = await axiosInstance.post<{ detail: string }>(`/services/${id}/enable/`);
    return response.data;
  },
};
