import axiosInstance from './axios';
import type { Appointment, BookingCreate, AvailableSlot } from '../types';

/**
 * API dla wizyt
 */

// Pobierz wszystkie wizyty
export const getAppointments = async (params?: {
  employee?: number;
  client?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
}): Promise<Appointment[]> => {
  const response = await axiosInstance.get('/appointments/', {
    params: { ...params, page_size: 1000 }
  });
  return response.data.results || response.data;
};

// Pobierz wizytę po ID
export const getAppointment = async (id: number): Promise<Appointment> => {
  const response = await axiosInstance.get<Appointment>(`/appointments/${id}/`);
  return response.data;
};

// Zarezerwuj wizytę
export const bookAppointment = async (data: BookingCreate): Promise<Appointment> => {
  const response = await axiosInstance.post<Appointment>('/appointments/book/', data);
  return response.data;
};

// Pobierz dostępne sloty
export const getAvailableSlots = async (
  employeeId: number,
  serviceId: number,
  date: string
): Promise<AvailableSlot[]> => {
  const response = await axiosInstance.get('/appointments/available-slots/', {
    params: { employee_id: employeeId, service_id: serviceId, date }
  });
  return response.data.slots || [];
};

// Potwierdź wizytę
export const confirmAppointment = async (id: number): Promise<Appointment> => {
  const response = await axiosInstance.post<Appointment>(`/appointments/${id}/confirm/`);
  return response.data;
};

// Anuluj wizytę
export const cancelAppointment = async (id: number): Promise<Appointment> => {
  const response = await axiosInstance.post<Appointment>(`/appointments/${id}/cancel/`);
  return response.data;
};

// Oznacz wizytę jako zakończoną
export const completeAppointment = async (id: number): Promise<Appointment> => {
  const response = await axiosInstance.post<Appointment>(`/appointments/${id}/complete/`);
  return response.data;
};

// Sprawdź dostępność konkretnego terminu
export const checkAvailability = async (data: {
  employee_id: number;
  service_id: number;
  start: string;
}): Promise<{ available: boolean; reason?: string }> => {
  const response = await axiosInstance.post('/appointments/check-availability/', data);
  return response.data;
};