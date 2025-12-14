import { api } from './axios';
import type {
  AppointmentCreateData,
  AppointmentDetail,
  AppointmentListItem,
  AppointmentStatusUpdateData,
  PaginatedResponse,
  BookingCreateData,
} from '../types';
import type { AxiosResponse } from 'axios';

// Parametry filtrowania i paginacji (zgodne z DRF filterset_fields + custom date_from/date_to)
interface AppointmentListParams {
  date_from?: string;
  date_to?: string;

  // DRF filterset_fields = ["status", "employee", "client", "service"]
  status?: string;
  employee?: number;
  client?: number;
  service?: number;

  // DRF PageNumberPagination
  page?: number;
  page_size?: number;
  ordering?: string;
}

interface AppointmentsApi {
  list: (params?: AppointmentListParams) => Promise<AxiosResponse<PaginatedResponse<AppointmentListItem>>>;
  myAppointments: () => Promise<AxiosResponse<AppointmentListItem[]>>;
  today: () => Promise<AxiosResponse<AppointmentListItem[]>>;
  upcoming: () => Promise<AxiosResponse<AppointmentListItem[]>>;
  detail: (id: number) => Promise<AxiosResponse<AppointmentDetail>>;
  create: (data: AppointmentCreateData) => Promise<AxiosResponse<AppointmentDetail>>;
  changeStatus: (id: number, data: AppointmentStatusUpdateData) => Promise<AxiosResponse<AppointmentDetail>>;
  cancelMy: (id: number, reason?: string) => Promise<AxiosResponse<AppointmentDetail>>;
  update: (id: number, data: Partial<AppointmentCreateData>) => Promise<AxiosResponse<AppointmentDetail>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;

  // client booking:
  book: (data: BookingCreateData) => Promise<AxiosResponse<AppointmentDetail>>;
}

// Endpointy API
const ENDPOINTS = {
  base: '/appointments/',
  myAppointments: '/appointments/my_appointments/',
  today: '/appointments/today/',
  upcoming: '/appointments/upcoming/',
  detail: (id: number) => `/appointments/${id}/`,
  changeStatus: (id: number) => `/appointments/${id}/change_status/`,
  cancelMy: (id: number) => `/appointments/${id}/cancel_my/`,
  bookings: '/bookings/',
} as const;

// Client booking endpoint
// POST /bookings/

/**
 * API do zarządzania wizytami
 */
export const appointmentsAPI: AppointmentsApi = {
  /**
   * Lista wszystkich wizyt (obsługa filtrów + paginacji DRF)
   */
  list: (params?: AppointmentListParams): Promise<AxiosResponse<PaginatedResponse<AppointmentListItem>>> => {
    return api.get<PaginatedResponse<AppointmentListItem>>(ENDPOINTS.base, { params });
  },

  /**
   * Moje wizyty (klient/pracownik) - backend zwraca tablicę (bez paginacji)
   */
  myAppointments: (): Promise<AxiosResponse<AppointmentListItem[]>> => {
    return api.get<AppointmentListItem[]>(ENDPOINTS.myAppointments);
  },

  /**
   * Wizyty dzisiaj - backend zwraca tablicę (bez paginacji)
   */
  today: (): Promise<AxiosResponse<AppointmentListItem[]>> => {
    return api.get<AppointmentListItem[]>(ENDPOINTS.today);
  },

  /**
   * Przyszłe wizyty - backend zwraca tablicę (bez paginacji)
   */
  upcoming: (): Promise<AxiosResponse<AppointmentListItem[]>> => {
    return api.get<AppointmentListItem[]>(ENDPOINTS.upcoming);
  },

  /**
   * Szczegóły wizyty
   */
  detail: (id: number): Promise<AxiosResponse<AppointmentDetail>> => {
    if (!id || id <= 0) return Promise.reject(new Error('Invalid appointment ID'));
    return api.get<AppointmentDetail>(ENDPOINTS.detail(id));
  },

  /**
   * Utwórz wizytę (manager/employee – backend może blokować client)
   */
  create: (data: AppointmentCreateData): Promise<AxiosResponse<AppointmentDetail>> => {
    return api.post<AppointmentDetail>(ENDPOINTS.base, data);
  },

  /**
   * Zmiana statusu wizyty
   */
  changeStatus: (id: number, data: AppointmentStatusUpdateData): Promise<AxiosResponse<AppointmentDetail>> => {
    if (!id || id <= 0) return Promise.reject(new Error('Invalid appointment ID'));
    return api.post<AppointmentDetail>(ENDPOINTS.changeStatus(id), data);
  },

  /**
   * Anulowanie wizyty przez klienta (tylko swojej)
   */
  cancelMy: (id: number, reason?: string): Promise<AxiosResponse<AppointmentDetail>> => {
    if (!id || id <= 0) return Promise.reject(new Error('Invalid appointment ID'));
    return api.post<AppointmentDetail>(ENDPOINTS.cancelMy(id), {
      cancellation_reason: reason ?? '',
    });
  },

  /**
   * Aktualizacja wizyty (PATCH)
   */
  update: (id: number, data: Partial<AppointmentCreateData>): Promise<AxiosResponse<AppointmentDetail>> => {
    if (!id || id <= 0) return Promise.reject(new Error('Invalid appointment ID'));
    return api.patch<AppointmentDetail>(ENDPOINTS.detail(id), data);
  },

  /**
   * Usunięcie wizyty
   */
  delete: (id: number): Promise<AxiosResponse<void>> => {
    if (!id || id <= 0) return Promise.reject(new Error('Invalid appointment ID'));
    return api.delete<void>(ENDPOINTS.detail(id));
  },

  /**
   * Rezerwacja klienta: POST /bookings/
   * Backend waliduje dostępność; frontend wybiera start ze slotów z /availability/slots/
   */
  book: (data: BookingCreateData): Promise<AxiosResponse<AppointmentDetail>> => {
    if (!data.employee || data.employee <= 0) {
      return Promise.reject(new Error('Invalid employee ID'));
    }
    if (!data.service || data.service <= 0) {
      return Promise.reject(new Error('Invalid service ID'));
    }
    if (!data.start) {
      return Promise.reject(new Error('Invalid start datetime'));
    }
    return api.post<AppointmentDetail>(ENDPOINTS.bookings, data);
  },
};
