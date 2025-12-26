// src/api/clients.ts
import axiosInstance from "@/api/axios";
import type { Client, DRFPaginated } from "@/types";

/**
 * Backend (ClientViewSet):
 * - filterset_fields = ["is_active", "client_number"]
 * - search_fields = ["client_number", "first_name", "last_name", "email", "phone"]
 * - ordering_fields = ["id", "client_number", "last_name", "created_at"]
 */
type ClientListParams = {
  is_active?: boolean;
  client_number?: string;
  search?: string;
  ordering?: string;
  page?: number;
};

/**
 * Backend ClientSerializer:
 * - create validate: wymaga kluczy "email" i "password" (nawet jeśli email może być null/blank)
 */
type ClientCreatePayload = {
  first_name: string;
  last_name: string;

  /**
   * Musi być wysłane przy tworzeniu (backend sprawdza obecność klucza),
   * może być null/"" jeśli chcesz, ale klucz ma istnieć.
   */
  email: string | null;

  phone?: string;

  internal_notes?: string | null;

  password: string;
  is_active?: boolean;
};

type ClientUpdatePayload = Partial<Omit<ClientCreatePayload, "password">> & {
  password?: string;
};

export const clientsApi = {
  /**
   * GET /api/clients/
   * DRF PageNumberPagination -> DRFPaginated<Client>
   */
  list: async (params?: ClientListParams): Promise<DRFPaginated<Client>> => {
    const response = await axiosInstance.get<DRFPaginated<Client>>("/clients/", { params });
    return response.data;
  },

  /**
   * GET /api/clients/{id}/
   */
  get: async (id: number): Promise<Client> => {
    const response = await axiosInstance.get<Client>(`/clients/${id}/`);
    return response.data;
  },

  /**
   * POST /api/clients/
   */
  create: async (data: ClientCreatePayload): Promise<Client> => {
    const response = await axiosInstance.post<Client>("/clients/", data);
    return response.data;
  },

  /**
   * PATCH /api/clients/{id}/
   */
  update: async (id: number, data: ClientUpdatePayload): Promise<Client> => {
    const response = await axiosInstance.patch<Client>(`/clients/${id}/`, data);
    return response.data;
  },

  /**
   * DELETE /api/clients/{id}/
   */
  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/clients/${id}/`);
  },

  /**
   * GET /api/clients/me/
   */
  me: async (): Promise<Client> => {
    const response = await axiosInstance.get<Client>("/clients/me/");
    return response.data;
  },
};
