import axiosInstance from '@/api/axios';
import type {
  Appointment,
  AppointmentStatus,
  BookingCreate,
  DRFPaginated,
} from '@/types';

type AppointmentListParams = {
  status?: AppointmentStatus;
  employee?: number;
  service?: number;
  client?: number;
  ordering?: string;
  page?: number;
};


type AppointmentCreatePayload = {
  client: number | null;
  employee: number;
  service: number;
  start: Date | string;
  end: Date | string;
  status?: AppointmentStatus;
  internal_notes?: string;
};

type AppointmentUpdatePayload = Partial<{
  client: number | null;
  employee: number;
  service: number;
  start: Date | string;
  end: Date | string;
  status: AppointmentStatus;
  internal_notes: string;
}>;


export const appointmentsApi = {
  list: async (
    params?: AppointmentListParams,
  ): Promise<DRFPaginated<Appointment>> => {
    const response = await axiosInstance.get<DRFPaginated<Appointment>>(
      '/appointments/',
      { params },
    );
    return response.data;
  },
  getMy: async (params?: {
    page?: number;
    ordering?: string;
  }): Promise<DRFPaginated<Appointment>> => {
    const response = await axiosInstance.get<DRFPaginated<Appointment>>(
      '/appointments/my/',
      { params },
    );
    return response.data;
  },
  get: async (id: number): Promise<Appointment> => {
    const response = await axiosInstance.get<Appointment>(
      `/appointments/${id}/`,
    );
    return response.data;
  },
  create: async (
    data: AppointmentCreatePayload,
  ): Promise<Appointment> => {
    const payload: AppointmentCreatePayload = {
      ...data,
      internal_notes: data.internal_notes ?? '',
    };

    const response = await axiosInstance.post<Appointment>(
      '/appointments/',
      payload,
    );
    return response.data;
  },
  update: async (
    id: number,
    data: AppointmentUpdatePayload,
  ): Promise<Appointment> => {
    const payload: AppointmentUpdatePayload = {
      ...data,
      ...(data.internal_notes !== undefined
        ? { internal_notes: data.internal_notes ?? '' }
        : {}),
    };

    const response = await axiosInstance.patch<Appointment>(
      `/appointments/${id}/`,
      payload,
    );
    return response.data;
  },
  book: async (payload: BookingCreate): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>(
      '/appointments/book/',
      payload,
    );
    return response.data;
  },
  confirm: async (id: number): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>(
      `/appointments/${id}/confirm/`,
    );
    return response.data;
  },
  cancel: async (id: number): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>(
      `/appointments/${id}/cancel/`,
    );
    return response.data;
  },
  complete: async (id: number): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>(
      `/appointments/${id}/complete/`,
    );
    return response.data;
  },
  noShow: async (id: number): Promise<Appointment> => {
    const response = await axiosInstance.post<Appointment>(
      `/appointments/${id}/no-show/`,
    );
    return response.data;
  },

  updateNotes: async (id: number, internal_notes: string): Promise<Appointment> => {
    const response = await axiosInstance.patch<Appointment>(
      `/appointments/${id}/notes/`,
      { internal_notes: internal_notes ?? '' },
    );
    return response.data;
  },

  remove: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/appointments/${id}/`);
  },

  getAvailableSlots: async (
    employeeId: number,
    serviceId: number,
    date: string,
  ): Promise<{
    date: string;
    slots: Array<{ start: string; end: string }>;
  }> => {
    const response = await axiosInstance.get<{
      date: string;
      slots: Array<{ start: string; end: string }>;
    }>('/availability/slots/', {
      params: {
        employee_id: employeeId,
        service_id: serviceId,
        date,
      },
    });

    return response.data;
  },

  checkAvailability: async (
    employeeId: number,
    serviceId: number,
    start: string,
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
    }>('/appointments/check-availability/', {
      employee_id: employeeId,
      service_id: serviceId,
      start,
    });

    return response.data;
  },
};