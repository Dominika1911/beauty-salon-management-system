import axiosInstance from "@/api/axios";
import type {
  Appointment,
  AppointmentStatus,
  BookingCreate,
  DRFPaginated,
} from "@/types";

/**
 * Parametry filtrowania dla listy wizyt (AppointmentViewSet)
 *
 * Backend:
 * - filterset_fields = ["status", "employee", "service", "client"]
 * - ordering_fields = ["start", "status", "created_at"]
 * - brak SearchFilter w AppointmentViewSet (nie wysyłamy search)
 */
type AppointmentListParams = {
  status?: AppointmentStatus;
  employee?: number;
  service?: number;
  client?: number;
  ordering?: string;
  page?: number;
};

export const appointmentsApi = {
  /**
   * GET /api/appointments/
   * DRF PageNumberPagination -> DRFPaginated<Appointment>
   */
  list: async (params?: AppointmentListParams): Promise<DRFPaginated<Appointment>> => {
    const response = await axiosInstance.get<DRFPaginated<Appointment>>("/appointments/", { params });
    return response.data;
  },

  /**
   * GET /api/appointments/my/
   * DRF action: AppointmentViewSet.my
   * Zawsze paginowane (backend wymusza paginację)
   *
   * Backend ordering_fields: ["start", "status", "created_at"]
   */
  getMy: async (params?: { page?: number; ordering?: string }): Promise<DRFPaginated<Appointment>> => {
    const response = await axiosInstance.get<DRFPaginated<Appointment>>("/appointments/my/", { params });
    return response.data;
  },


  /**
   * GET /api/appointments/{id}/
   */
  get: async (id: number): Promise<Appointment> => {
    const response = await axiosInstance.get<Appointment>(`/appointments/${id}/`);
    return response.data;
  },

  /**
   * POST /api/appointments/
   * (W panelu admin/employee możesz tworzyć Appointment bez booking flow)
   *
   * Uwaga:
   * Backend AppointmentSerializer oczekuje pól: client, employee, service, start, end, status? (opcjonalnie)
   * i waliduje konflikty. Jeśli nie używasz tego endpointu w UI, możesz go pominąć.
   */
  create: async (data: {
    client: number | null;
    employee: number;
    service: number;
    start: string;
    end: string;
    status?: AppointmentStatus;
    internal_notes?: string | null;
  }): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>("/appointments/", data);
    return response.data;
  },

  /**
   * PATCH /api/appointments/{id}/
   */
  update: async (
    id: number,
    data: Partial<{
      client: number | null;
      employee: number;
      service: number;
      start: string;
      end: string;
      status: AppointmentStatus;
      internal_notes: string | null;
    }>
  ): Promise<Appointment> => {
    const response = await axiosInstance.patch<Appointment>(`/appointments/${id}/`, data);
    return response.data;
  },

  /**
   * Rezerwacja (booking flow)
   * POST /api/appointments/book/
   */
  book: async (payload: BookingCreate): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>("/appointments/book/", payload);
    return response.data;
  },

  /**
   * POST /api/appointments/{id}/confirm/
   */
  confirm: async (id: number): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>(`/appointments/${id}/confirm/`);
    return response.data;
  },

  /**
   * POST /api/appointments/{id}/cancel/
   */
  cancel: async (id: number): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>(`/appointments/${id}/cancel/`);
    return response.data;
  },

  /**
   * POST /api/appointments/{id}/complete/
   */
  complete: async (id: number): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>(`/appointments/${id}/complete/`);
    return response.data;
  },

  /**
   * DELETE /api/appointments/{id}/
   */
  remove: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/appointments/${id}/`);
  },

  /**
   * GET /api/availability/slots/
   */
  getAvailableSlots: async (
    employeeId: number,
    serviceId: number,
    date: string
  ): Promise<{
    date: string;
    slots: Array<{ start: string; end: string }>;
  }> => {
    const response = await axiosInstance.get<{
      date: string;
      slots: Array<{ start: string; end: string }>;
    }>("/availability/slots/", {
      params: { employee_id: employeeId, service_id: serviceId, date },
    });

    return response.data;
  },

  /**
   * POST /api/appointments/check-availability/
   */
  checkAvailability: async (
    employeeId: number,
    serviceId: number,
    start: string
  ): Promise<{
    available: boolean;
    reason?: string;
    start?: string;
    end?: string;
    duration_minutes?: number;
  }> => {
    const response = await axiosInstance.post<{
      available: boolean;
      reason?: string;
      start?: string;
      end?: string;
      duration_minutes?: number;
    }>("/appointments/check-availability/", {
      employee_id: employeeId,
      service_id: serviceId,
      start,
    });

    return response.data;
  },
};
