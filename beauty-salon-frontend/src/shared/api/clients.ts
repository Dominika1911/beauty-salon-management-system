import type { AxiosResponse } from 'axios';
import { api } from './axios';
import type {
  AppointmentListItem,
  Client,
  ClientCreateUpdateData,
  PaginatedResponse,
} from '@/shared/types';

type PreferredContact = 'email' | 'sms' | 'phone' | 'none';

export interface ClientListParams {
  email?: string;
  marketing_consent?: boolean;
  preferred_contact?: PreferredContact;
  deleted_at?: string;
  /**
   * Nie zgadujemy pól backendu – zostaje string.
   */
  ordering?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

/**
 * Payload wymagany przez backend:
 * POST /clients/soft_delete/
 */
export interface ClientSoftDeletePayload {
  client: number;
}

export interface DetailResponse {
  detail: string;
}

export interface ClientsApi {
  list: (params?: ClientListParams) => Promise<AxiosResponse<PaginatedResponse<Client>>>;
  detail: (id: number) => Promise<AxiosResponse<Client>>;
  create: (data: ClientCreateUpdateData) => Promise<AxiosResponse<Client>>;
  update: (id: number, data: Partial<ClientCreateUpdateData>) => Promise<AxiosResponse<Client>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;

  me: () => Promise<AxiosResponse<Client>>;
  myAppointments: () => Promise<AxiosResponse<AppointmentListItem[]>>;

  softDeleted: (params?: ClientListParams) => Promise<AxiosResponse<Client[]>>;

  /**
   * ✅ POPRAWNE
   * POST /clients/soft_delete/
   * body: { client: number }
   */
  softDelete: (id: number) => Promise<AxiosResponse<DetailResponse>>;
}

const ENDPOINTS = {
  base: '/clients/',
  detail: (id: number) => `/clients/${id}/`,
  me: '/clients/me/',
  myAppointments: '/clients/my_appointments/',
  softDeleted: '/clients/soft_deleted/',
  softDelete: '/clients/soft_delete/',
} as const;

export const clientsAPI: ClientsApi = {
  list: (params) => api.get<PaginatedResponse<Client>>(ENDPOINTS.base, { params }),

  detail: (id) => api.get<Client>(ENDPOINTS.detail(id)),

  create: (data) => api.post<Client>(ENDPOINTS.base, data),

  update: (id, data) => api.patch<Client>(ENDPOINTS.detail(id), data),

  delete: (id) => api.delete<void>(ENDPOINTS.detail(id)),

  me: () => api.get<Client>(ENDPOINTS.me),

  myAppointments: () => api.get<AppointmentListItem[]>(ENDPOINTS.myAppointments),

  softDeleted: (params) => api.get<Client[]>(ENDPOINTS.softDeleted, { params }),

  softDelete: (id) =>
    api.post<DetailResponse>(ENDPOINTS.softDelete, {
      client: id,
    } satisfies ClientSoftDeletePayload),
};
