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
 * - create validate: wymaga kluczy "email" i "password"
 */
type ClientCreatePayload = {
  first_name: string;
  last_name: string;

  /**
   * Klucz musi istnieć (backend tego wymaga),
   * wartość może być null lub "".
   */
  email: string | null;

  phone?: string;

  /**
   * Backend: TextField(blank=True) -> string
   * Nigdy nie wysyłamy null.
   */
  internal_notes?: string;

  password: string;
  is_active?: boolean;
};

type ClientUpdatePayload = Partial<Omit<ClientCreatePayload, "password">> & {
  password?: string;
};

export const clientsApi = {
  /**
   * GET /api/clients/
   */
  list: async (params?: ClientListParams): Promise<DRFPaginated<Client>> => {
    const response = await axiosInstance.get<DRFPaginated<Client>>("/clients/", {
      params,
    });
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
    const payload: ClientCreatePayload = {
      ...data,
      internal_notes: data.internal_notes ?? "",
    };

    const response = await axiosInstance.post<Client>("/clients/", payload);
    return response.data;
  },

  /**
   * PATCH /api/clients/{id}/
   */
  update: async (id: number, data: ClientUpdatePayload): Promise<Client> => {
    const payload: ClientUpdatePayload = {
      ...data,
      ...(data.internal_notes !== undefined
        ? { internal_notes: data.internal_notes ?? "" }
        : {}),
    };

    const response = await axiosInstance.patch<Client>(
      `/clients/${id}/`,
      payload
    );
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
